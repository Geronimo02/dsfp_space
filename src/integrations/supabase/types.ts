export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          action: string
          created_at: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          page_url: string | null
          success: boolean | null
          user_agent: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          page_url?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          page_url?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          cash_register_id: string
          category: string
          created_at: string
          description: string | null
          id: string
          reference: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          cash_register_id: string
          category: string
          created_at?: string
          description?: string | null
          id?: string
          reference?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          cash_register_id?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          reference?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closing_amount: number | null
          closing_date: string | null
          created_at: string
          difference: number | null
          expected_amount: number | null
          id: string
          notes: string | null
          opening_amount: number
          opening_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closing_amount?: number | null
          closing_date?: string | null
          created_at?: string
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opening_amount?: number
          opening_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          closing_amount?: number | null
          closing_date?: string | null
          created_at?: string
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opening_amount?: number
          opening_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          backup_enabled: boolean | null
          card_surcharge_rate: number | null
          company_name: string
          created_at: string
          currency: string | null
          default_tax_rate: number | null
          email: string | null
          id: string
          last_backup_date: string | null
          logo_url: string | null
          low_stock_alert: boolean | null
          loyalty_bronze_discount: number | null
          loyalty_bronze_threshold: number | null
          loyalty_currency_per_point: number | null
          loyalty_enabled: boolean | null
          loyalty_gold_discount: number | null
          loyalty_gold_threshold: number | null
          loyalty_points_per_currency: number | null
          loyalty_silver_discount: number | null
          loyalty_silver_threshold: number | null
          phone: string | null
          receipt_footer: string | null
          receipt_format: string | null
          receipt_printer_name: string | null
          tax_id: string | null
          updated_at: string
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          backup_enabled?: boolean | null
          card_surcharge_rate?: number | null
          company_name: string
          created_at?: string
          currency?: string | null
          default_tax_rate?: number | null
          email?: string | null
          id?: string
          last_backup_date?: string | null
          logo_url?: string | null
          low_stock_alert?: boolean | null
          loyalty_bronze_discount?: number | null
          loyalty_bronze_threshold?: number | null
          loyalty_currency_per_point?: number | null
          loyalty_enabled?: boolean | null
          loyalty_gold_discount?: number | null
          loyalty_gold_threshold?: number | null
          loyalty_points_per_currency?: number | null
          loyalty_silver_discount?: number | null
          loyalty_silver_threshold?: number | null
          phone?: string | null
          receipt_footer?: string | null
          receipt_format?: string | null
          receipt_printer_name?: string | null
          tax_id?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          backup_enabled?: boolean | null
          card_surcharge_rate?: number | null
          company_name?: string
          created_at?: string
          currency?: string | null
          default_tax_rate?: number | null
          email?: string | null
          id?: string
          last_backup_date?: string | null
          logo_url?: string | null
          low_stock_alert?: boolean | null
          loyalty_bronze_discount?: number | null
          loyalty_bronze_threshold?: number | null
          loyalty_currency_per_point?: number | null
          loyalty_enabled?: boolean | null
          loyalty_gold_discount?: number | null
          loyalty_gold_threshold?: number | null
          loyalty_points_per_currency?: number | null
          loyalty_silver_discount?: number | null
          loyalty_silver_threshold?: number | null
          phone?: string | null
          receipt_footer?: string | null
          receipt_format?: string | null
          receipt_printer_name?: string | null
          tax_id?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      credit_notes: {
        Row: {
          amount: number
          balance: number
          created_at: string | null
          credit_note_number: string
          customer_id: string
          expires_at: string | null
          id: string
          return_id: string | null
          status: string | null
          updated_at: string | null
          used_amount: number | null
        }
        Insert: {
          amount: number
          balance: number
          created_at?: string | null
          credit_note_number: string
          customer_id: string
          expires_at?: string | null
          id?: string
          return_id?: string | null
          status?: string | null
          updated_at?: string | null
          used_amount?: number | null
        }
        Update: {
          amount?: number
          balance?: number
          created_at?: string | null
          credit_note_number?: string
          customer_id?: string
          expires_at?: string | null
          id?: string
          return_id?: string | null
          status?: string | null
          updated_at?: string | null
          used_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_pos_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          sale_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          sale_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          sale_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          credit_limit: number | null
          current_balance: number | null
          document: string | null
          email: string | null
          id: string
          loyalty_points: number | null
          loyalty_tier: string | null
          name: string
          payment_terms: string | null
          phone: string | null
          total_purchases: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number | null
          document?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          loyalty_tier?: string | null
          name: string
          payment_terms?: string | null
          phone?: string | null
          total_purchases?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number | null
          document?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          loyalty_tier?: string | null
          name?: string
          payment_terms?: string | null
          phone?: string | null
          total_purchases?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_note_items: {
        Row: {
          created_at: string | null
          delivery_note_id: string
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          delivery_note_id: string
          id?: string
          product_id?: string | null
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          delivery_note_id?: string
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_items_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          created_at: string | null
          customer_id: string
          customer_name: string
          delivery_address: string | null
          delivery_date: string | null
          delivery_number: string
          id: string
          notes: string | null
          received_at: string | null
          received_by: string | null
          sale_id: string | null
          signature_url: string | null
          status: Database["public"]["Enums"]["delivery_status"] | null
          subtotal: number
          total: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          customer_name: string
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_number: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          sale_id?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          subtotal?: number
          total: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_number?: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          sale_id?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          subtotal?: number
          total?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          created_at: string | null
          customer_id: string
          description: string | null
          id: string
          points: number
          reference_id: string | null
          reference_type: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          description?: string | null
          id?: string
          points: number
          reference_id?: string | null
          reference_type?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          description?: string | null
          id?: string
          points?: number
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_pos_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean | null
          barcode: string | null
          batch_number: string | null
          category: string | null
          cost: number | null
          created_at: string
          description: string | null
          expiration_date: string | null
          id: string
          image_url: string | null
          last_restock_date: string | null
          location: string | null
          min_stock: number | null
          name: string
          price: number
          reorder_point: number | null
          sku: string | null
          stock: number
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          barcode?: string | null
          batch_number?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          expiration_date?: string | null
          id?: string
          image_url?: string | null
          last_restock_date?: string | null
          location?: string | null
          min_stock?: number | null
          name: string
          price?: number
          reorder_point?: number | null
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          barcode?: string | null
          batch_number?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          expiration_date?: string | null
          id?: string
          image_url?: string | null
          last_restock_date?: string | null
          location?: string | null
          min_stock?: number | null
          name?: string
          price?: number
          reorder_point?: number | null
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean | null
          applies_to: string | null
          category: string | null
          code: string
          created_at: string | null
          current_uses: number | null
          description: string | null
          end_date: string | null
          id: string
          max_uses: number | null
          min_amount: number | null
          min_quantity: number | null
          name: string
          product_id: string | null
          start_date: string
          type: string
          updated_at: string | null
          value: number
        }
        Insert: {
          active?: boolean | null
          applies_to?: string | null
          category?: string | null
          code: string
          created_at?: string | null
          current_uses?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          max_uses?: number | null
          min_amount?: number | null
          min_quantity?: number | null
          name: string
          product_id?: string | null
          start_date: string
          type: string
          updated_at?: string | null
          value: number
        }
        Update: {
          active?: boolean | null
          applies_to?: string | null
          category?: string | null
          code?: string
          created_at?: string | null
          current_uses?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          max_uses?: number | null
          min_amount?: number | null
          min_quantity?: number | null
          name?: string
          product_id?: string | null
          start_date?: string
          type?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          purchase_id: string
          quantity: number
          subtotal: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          purchase_id: string
          quantity: number
          subtotal: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          purchase_id?: string
          quantity?: number
          subtotal?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          payment_status: string
          purchase_date: string
          purchase_number: string
          subtotal: number
          supplier_id: string
          tax: number | null
          tax_rate: number | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          payment_status?: string
          purchase_date?: string
          purchase_number: string
          subtotal?: number
          supplier_id: string
          tax?: number | null
          tax_rate?: number | null
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          payment_status?: string
          purchase_date?: string
          purchase_number?: string
          subtotal?: number
          supplier_id?: string
          tax?: number | null
          tax_rate?: number | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          quotation_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_name: string
          quantity: number
          quotation_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          quotation_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          converted_to_sale_id: string | null
          created_at: string | null
          customer_id: string
          customer_name: string
          discount: number | null
          discount_rate: number | null
          id: string
          notes: string | null
          quotation_number: string
          status: Database["public"]["Enums"]["quotation_status"] | null
          subtotal: number
          tax: number | null
          tax_rate: number | null
          total: number
          updated_at: string | null
          user_id: string
          valid_until: string | null
        }
        Insert: {
          converted_to_sale_id?: string | null
          created_at?: string | null
          customer_id: string
          customer_name: string
          discount?: number | null
          discount_rate?: number | null
          id?: string
          notes?: string | null
          quotation_number: string
          status?: Database["public"]["Enums"]["quotation_status"] | null
          subtotal?: number
          tax?: number | null
          tax_rate?: number | null
          total: number
          updated_at?: string | null
          user_id: string
          valid_until?: string | null
        }
        Update: {
          converted_to_sale_id?: string | null
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          discount?: number | null
          discount_rate?: number | null
          id?: string
          notes?: string | null
          quotation_number?: string
          status?: Database["public"]["Enums"]["quotation_status"] | null
          subtotal?: number
          tax?: number | null
          tax_rate?: number | null
          total?: number
          updated_at?: string | null
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      reservation_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          reservation_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_name: string
          quantity: number
          reservation_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          reservation_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_items_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string
          reservation_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method: string
          reservation_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string
          reservation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_payments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          completed_at: string | null
          converted_to_sale_id: string | null
          created_at: string | null
          customer_id: string
          customer_name: string
          expiration_date: string | null
          id: string
          notes: string | null
          paid_amount: number | null
          remaining_amount: number
          reservation_number: string
          status: string | null
          subtotal: number
          tax: number | null
          tax_rate: number | null
          total: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          converted_to_sale_id?: string | null
          created_at?: string | null
          customer_id: string
          customer_name: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          remaining_amount: number
          reservation_number: string
          status?: string | null
          subtotal?: number
          tax?: number | null
          tax_rate?: number | null
          total: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          converted_to_sale_id?: string | null
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          remaining_amount?: number
          reservation_number?: string
          status?: string | null
          subtotal?: number
          tax?: number | null
          tax_rate?: number | null
          total?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_converted_to_sale_id_fkey"
            columns: ["converted_to_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_pos_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          return_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_name: string
          quantity: number
          return_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          return_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          completed_at: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string
          id: string
          notes: string | null
          reason: string
          refund_method: string | null
          return_number: string
          sale_id: string | null
          status: string | null
          subtotal: number
          total: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name: string
          id?: string
          notes?: string | null
          reason: string
          refund_method?: string | null
          return_number: string
          sale_id?: string | null
          status?: string | null
          subtotal?: number
          total: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string
          id?: string
          notes?: string | null
          reason?: string
          refund_method?: string | null
          return_number?: string
          sale_id?: string | null
          status?: string | null
          subtotal?: number
          total?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_pos_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_export: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_export?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_export?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          card_surcharge: number | null
          created_at: string | null
          id: string
          installments: number | null
          notes: string | null
          payment_method: string
          sale_id: string
        }
        Insert: {
          amount: number
          card_surcharge?: number | null
          created_at?: string | null
          id?: string
          installments?: number | null
          notes?: string | null
          payment_method: string
          sale_id: string
        }
        Update: {
          amount?: number
          card_surcharge?: number | null
          created_at?: string | null
          id?: string
          installments?: number | null
          notes?: string | null
          payment_method?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          customer_id: string | null
          discount: number | null
          discount_rate: number | null
          id: string
          installment_amount: number | null
          installments: number | null
          notes: string | null
          payment_method: string
          sale_number: string
          status: string | null
          subtotal: number
          tax: number | null
          tax_rate: number | null
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          discount_rate?: number | null
          id?: string
          installment_amount?: number | null
          installments?: number | null
          notes?: string | null
          payment_method: string
          sale_number: string
          status?: string | null
          subtotal?: number
          tax?: number | null
          tax_rate?: number | null
          total: number
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          discount_rate?: number | null
          id?: string
          installment_amount?: number | null
          installments?: number | null
          notes?: string | null
          payment_method?: string
          sale_number?: string
          status?: string | null
          subtotal?: number
          tax?: number | null
          tax_rate?: number | null
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_pos_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_parts: {
        Row: {
          created_at: string
          id: string
          part_name: string
          product_id: string | null
          quantity: number
          service_id: string
          subtotal: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          part_name: string
          product_id?: string | null
          quantity?: number
          service_id: string
          subtotal: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          part_name?: string
          product_id?: string | null
          quantity?: number
          service_id?: string
          subtotal?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_parts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_parts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "technical_services"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          purchase_id: string | null
          supplier_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          purchase_id?: string | null
          supplier_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          purchase_id?: string | null
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean | null
          address: string | null
          contact_name: string | null
          created_at: string
          credit_limit: number | null
          current_balance: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          contact_name?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          address?: string | null
          contact_name?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      technical_services: {
        Row: {
          brand: string | null
          completed_date: string | null
          created_at: string
          customer_id: string | null
          delivered_date: string | null
          device_type: string
          diagnosis: string | null
          estimated_completion_date: string | null
          id: string
          labor_cost: number | null
          model: string | null
          notes: string | null
          parts_cost: number | null
          received_date: string
          reported_issue: string
          serial_number: string | null
          service_number: string
          status: Database["public"]["Enums"]["service_status"]
          total_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          completed_date?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_date?: string | null
          device_type: string
          diagnosis?: string | null
          estimated_completion_date?: string | null
          id?: string
          labor_cost?: number | null
          model?: string | null
          notes?: string | null
          parts_cost?: number | null
          received_date?: string
          reported_issue: string
          serial_number?: string | null
          service_number: string
          status?: Database["public"]["Enums"]["service_status"]
          total_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          completed_date?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_date?: string | null
          device_type?: string
          diagnosis?: string | null
          estimated_completion_date?: string | null
          id?: string
          labor_cost?: number | null
          model?: string | null
          notes?: string | null
          parts_cost?: number | null
          received_date?: string
          reported_issue?: string
          serial_number?: string | null
          service_number?: string
          status?: Database["public"]["Enums"]["service_status"]
          total_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_services_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_pos_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_services_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      customer_pos_view: {
        Row: {
          credit_limit: number | null
          current_balance: number | null
          id: string | null
          name: string | null
        }
        Insert: {
          credit_limit?: number | null
          current_balance?: number | null
          id?: string | null
          name?: string | null
        }
        Update: {
          credit_limit?: number | null
          current_balance?: number | null
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_expiring_products: { Args: never; Returns: undefined }
      check_low_stock_alerts: { Args: never; Returns: undefined }
      generate_credit_note_number: { Args: never; Returns: string }
      generate_delivery_number: { Args: never; Returns: string }
      generate_quotation_number: { Args: never; Returns: string }
      generate_reservation_number: { Args: never; Returns: string }
      generate_return_number: { Args: never; Returns: string }
      generate_service_number: { Args: never; Returns: string }
      has_permission: {
        Args: { _module: string; _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "employee"
        | "cashier"
        | "accountant"
        | "viewer"
      delivery_status: "pending" | "in_transit" | "delivered" | "cancelled"
      quotation_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "converted"
      service_status:
        | "received"
        | "in_diagnosis"
        | "in_repair"
        | "ready"
        | "delivered"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "manager",
        "employee",
        "cashier",
        "accountant",
        "viewer",
      ],
      delivery_status: ["pending", "in_transit", "delivered", "cancelled"],
      quotation_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "converted",
      ],
      service_status: [
        "received",
        "in_diagnosis",
        "in_repair",
        "ready",
        "delivered",
      ],
    },
  },
} as const
