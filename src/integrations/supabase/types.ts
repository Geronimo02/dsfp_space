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
      bulk_operations: {
        Row: {
          company_id: string | null
          completed_at: string | null
          created_at: string
          entity_type: string
          error_message: string | null
          id: string
          operation_data: Json | null
          operation_type: string
          records_affected: number
          status: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          entity_type: string
          error_message?: string | null
          id?: string
          operation_data?: Json | null
          operation_type: string
          records_affected?: number
          status?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          operation_data?: Json | null
          operation_type?: string
          records_affected?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_operations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          cash_register_id: string
          category: string
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
          {
            foreignKeyName: "cash_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closing_amount: number | null
          closing_date: string | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "cash_registers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean | null
          address: string | null
          backup_enabled: boolean | null
          card_surcharge_rate: number | null
          created_at: string | null
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
          name: string
          phone: string | null
          receipt_footer: string | null
          receipt_format: string | null
          receipt_printer_name: string | null
          tax_id: string | null
          updated_at: string | null
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          backup_enabled?: boolean | null
          card_surcharge_rate?: number | null
          created_at?: string | null
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
          name: string
          phone?: string | null
          receipt_footer?: string | null
          receipt_format?: string | null
          receipt_printer_name?: string | null
          tax_id?: string | null
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          backup_enabled?: boolean | null
          card_surcharge_rate?: number | null
          created_at?: string | null
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
          name?: string
          phone?: string | null
          receipt_footer?: string | null
          receipt_format?: string | null
          receipt_printer_name?: string | null
          tax_id?: string | null
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
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
      company_users: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount: number
          balance: number
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "credit_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      customer_account_movements: {
        Row: {
          balance: number | null
          company_id: string | null
          created_at: string | null
          credit_amount: number | null
          customer_id: string
          debit_amount: number | null
          description: string | null
          due_date: string | null
          id: string
          movement_date: string | null
          movement_type: string
          quotation_id: string | null
          reference_number: string | null
          reservation_id: string | null
          return_id: string | null
          sale_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          company_id?: string | null
          created_at?: string | null
          credit_amount?: number | null
          customer_id: string
          debit_amount?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          movement_date?: string | null
          movement_type: string
          quotation_id?: string | null
          reference_number?: string | null
          reservation_id?: string | null
          return_id?: string | null
          sale_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          company_id?: string | null
          created_at?: string | null
          credit_amount?: number | null
          customer_id?: string
          debit_amount?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          movement_date?: string | null
          movement_type?: string
          quotation_id?: string | null
          reference_number?: string | null
          reservation_id?: string | null
          return_id?: string | null
          sale_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_account_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_movements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_pos_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_movements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_movements_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_movements_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_movements_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          sale_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_items: {
        Row: {
          created_at: string | null
          delivery_note_id: string
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          quotation_item_id: string | null
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
          quotation_item_id?: string | null
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
          quotation_item_id?: string | null
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
          {
            foreignKeyName: "delivery_note_items_quotation_item_id_fkey"
            columns: ["quotation_item_id"]
            isOneToOne: false
            referencedRelation: "quotation_items"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          company_id: string | null
          created_at: string | null
          customer_id: string
          customer_name: string
          delivery_address: string | null
          delivery_date: string | null
          delivery_number: string
          id: string
          notes: string | null
          quotation_id: string | null
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
          company_id?: string | null
          created_at?: string | null
          customer_id: string
          customer_name: string
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_number: string
          id?: string
          notes?: string | null
          quotation_id?: string | null
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
          company_id?: string | null
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_number?: string
          id?: string
          notes?: string | null
          quotation_id?: string | null
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
            foreignKeyName: "delivery_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          company_id: string | null
          created_at: string | null
          currency: string
          id: string
          rate: number
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          currency: string
          id?: string
          rate: number
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          rate?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          active: boolean | null
          color: string | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          company_id: string | null
          created_at: string
          description: string
          expense_date: string
          expense_number: string
          id: string
          notes: string | null
          payment_method: string
          receipt_url: string | null
          reference_number: string | null
          status: string
          supplier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          expense_date?: string
          expense_number: string
          id?: string
          notes?: string | null
          payment_method: string
          receipt_url?: string | null
          reference_number?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          expense_number?: string
          id?: string
          notes?: string | null
          payment_method?: string
          receipt_url?: string | null
          reference_number?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payment_applications: {
        Row: {
          amount_applied: number
          applied_date: string | null
          company_id: string | null
          created_at: string | null
          customer_id: string
          id: string
          payment_id: string
          sale_id: string
          user_id: string
        }
        Insert: {
          amount_applied: number
          applied_date?: string | null
          company_id?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          payment_id: string
          sale_id: string
          user_id: string
        }
        Update: {
          amount_applied?: number
          applied_date?: string | null
          company_id?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          payment_id?: string
          sale_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payment_applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_applications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_pos_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_applications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "customer_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_applications_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "loyalty_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          barcode: string | null
          batch_number: string | null
          category: string | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
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
          warehouse_id: string | null
        }
        Insert: {
          company_id?: string | null
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
          warehouse_id?: string | null
        }
        Update: {
          company_id?: string | null
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
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
          total_delivered: number | null
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
          total_delivered?: number | null
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
          total_delivered?: number | null
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
          company_id: string | null
          converted_to_sale_id: string | null
          created_at: string | null
          currency: string | null
          customer_id: string
          customer_name: string
          delivery_status: string | null
          discount: number | null
          discount_rate: number | null
          exchange_rate: number | null
          id: string
          notes: string | null
          quotation_number: string
          status: Database["public"]["Enums"]["quotation_status"] | null
          subtotal: number
          tax: number | null
          tax_rate: number | null
          total: number
          total_delivered: number | null
          updated_at: string | null
          user_id: string
          valid_until: string | null
        }
        Insert: {
          company_id?: string | null
          converted_to_sale_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id: string
          customer_name: string
          delivery_status?: string | null
          discount?: number | null
          discount_rate?: number | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          quotation_number: string
          status?: Database["public"]["Enums"]["quotation_status"] | null
          subtotal?: number
          tax?: number | null
          tax_rate?: number | null
          total: number
          total_delivered?: number | null
          updated_at?: string | null
          user_id: string
          valid_until?: string | null
        }
        Update: {
          company_id?: string | null
          converted_to_sale_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string
          customer_name?: string
          delivery_status?: string | null
          discount?: number | null
          discount_rate?: number | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          quotation_number?: string
          status?: Database["public"]["Enums"]["quotation_status"] | null
          subtotal?: number
          tax?: number | null
          tax_rate?: number | null
          total?: number
          total_delivered?: number | null
          updated_at?: string | null
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
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
          warehouse_id: string | null
        }
        Insert: {
          company_id?: string | null
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
          warehouse_id?: string | null
        }
        Update: {
          company_id?: string | null
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
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "sales_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_services: {
        Row: {
          brand: string | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "technical_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      ticket_config: {
        Row: {
          accent_color: string | null
          company_address: string | null
          company_email: string | null
          company_name: string
          company_phone: string | null
          created_at: string | null
          font_size: string | null
          footer_message: string | null
          header_color: string | null
          id: string
          logo_url: string | null
          paper_width: string | null
          show_logo: boolean | null
          show_qr: boolean | null
          text_color: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          created_at?: string | null
          font_size?: string | null
          footer_message?: string | null
          header_color?: string | null
          id?: string
          logo_url?: string | null
          paper_width?: string | null
          show_logo?: boolean | null
          show_qr?: boolean | null
          text_color?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          created_at?: string | null
          font_size?: string | null
          footer_message?: string | null
          header_color?: string | null
          id?: string
          logo_url?: string | null
          paper_width?: string | null
          show_logo?: boolean | null
          show_qr?: boolean | null
          text_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      warehouse_stock: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          last_restock_date: string | null
          min_stock: number | null
          product_id: string
          stock: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          last_restock_date?: string | null
          min_stock?: number | null
          product_id: string
          stock?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          last_restock_date?: string | null
          min_stock?: number | null
          product_id?: string
          stock?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_stock_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_transfer_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          product_name: string
          quantity: number
          transfer_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          product_name: string
          quantity: number
          transfer_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "warehouse_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_transfers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string | null
          created_at: string
          from_warehouse_id: string
          id: string
          notes: string | null
          received_at: string | null
          received_by: string | null
          requested_by: string
          status: string
          to_warehouse_id: string
          transfer_date: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          from_warehouse_id: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          requested_by: string
          status?: string
          to_warehouse_id: string
          transfer_date?: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          requested_by?: string
          status?: string
          to_warehouse_id?: string
          transfer_date?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          active: boolean | null
          address: string | null
          code: string
          company_id: string | null
          created_at: string
          id: string
          is_main: boolean | null
          manager_name: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          code: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_main?: boolean | null
          manager_name?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          address?: string | null
          code?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_main?: boolean | null
          manager_name?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      apply_payment_to_invoice: {
        Args: {
          p_amount_applied: number
          p_customer_id: string
          p_payment_id: string
          p_sale_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      check_expiring_products: { Args: never; Returns: undefined }
      check_low_stock_alerts: { Args: never; Returns: undefined }
      create_customer_payment: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_notes: string
          p_payment_method: string
          p_user_id: string
        }
        Returns: string
      }
      generate_credit_note_number: { Args: never; Returns: string }
      generate_delivery_number: { Args: never; Returns: string }
      generate_expense_number: { Args: never; Returns: string }
      generate_quotation_number: { Args: never; Returns: string }
      generate_reservation_number: { Args: never; Returns: string }
      generate_return_number: { Args: never; Returns: string }
      generate_service_number: { Args: never; Returns: string }
      generate_transfer_number: { Args: never; Returns: string }
      get_all_customer_movements: {
        Args: { search_query?: string }
        Returns: {
          balance: number
          credit_amount: number
          customer_id: string
          customer_name: string
          debit_amount: number
          description: string
          id: string
          movement_date: string
          movement_type: string
          reference_number: string
          sale_id: string
          status: string
        }[]
      }
      get_customer_movements: {
        Args: { customer_id: string }
        Returns: {
          balance: number
          credit_amount: number
          debit_amount: number
          description: string
          id: string
          movement_date: string
          movement_type: string
          reference_number: string
          status: string
        }[]
      }
      get_invoice_payments: {
        Args: { customer_id: string }
        Returns: {
          amount_applied: number
          applied_date: string
          id: string
          sale_id: string
        }[]
      }
      get_user_company: { Args: { _user_id: string }; Returns: string }
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
      has_role_in_company: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
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
        | "warehouse"
        | "technician"
        | "auditor"
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
        "warehouse",
        "technician",
        "auditor",
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
