import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

/**
 * Centralized authentication hook
 * Provides cached user data and session management
 * Prevents multiple getUser() calls across components
 */
export function useAuth() {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<ReturnType<typeof supabase.auth.onAuthStateChange> | null>(null);

  // Cache user data with React Query
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 1,
  });

  // Cache session data
  const { data: session } = useQuery({
    queryKey: ['auth-session'],
    queryFn: async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  // Set up auth state listener with proper cleanup
  useEffect(() => {
    if (subscriptionRef.current) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (import.meta.env.DEV) {
          console.log('[useAuth] Auth state changed:', event);
        }

        // Update cached data
        queryClient.setQueryData(['auth-session'], session);
        queryClient.setQueryData(['auth-user'], session?.user ?? null);

        // Invalidate related queries on sign out
        if (event === 'SIGNED_OUT') {
          queryClient.clear();
        }

        // Refresh on sign in
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          queryClient.invalidateQueries({ queryKey: ['auth-user'] });
          queryClient.invalidateQueries({ queryKey: ['auth-session'] });
        }
      }
    );

    subscriptionRef.current = subscription;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [queryClient]);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      queryClient.clear();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  return {
    user: user ?? null,
    session: session ?? null,
    isLoading,
    isAuthenticated: !!user,
    error,
    signOut,
  };
}

/**
 * Hook to safely access current user
 * Throws if used outside of authenticated context
 */
export function useRequireAuth() {
  const auth = useAuth();
  
  if (!auth.isLoading && !auth.user) {
    throw new Error('useRequireAuth must be used in an authenticated context');
  }

  return auth;
}
