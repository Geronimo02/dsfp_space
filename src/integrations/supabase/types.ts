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
      bank_accounts: {
        Row: {
          account_number: string
          account_type: string
          active: boolean | null
          balance: number
          bank_name: string
          company_id: string | null
          created_at: string | null
          currency: string
          id: string
          updated_at: string | null
        }
        Insert: {
          account_number: string
          account_type?: string
          active?: boolean | null
          balance?: number
          bank_name: string
          company_id?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          account_number?: string
          account_type?: string
          active?: boolean | null
          balance?: number
          bank_name?: string
          company_id?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_movements: {
        Row: {
          amount: number
          bank_account_id: string
          company_id: string | null
          created_at: string | null
          description: string | null
          destination_account_id: string | null
          id: string
          movement_date: string
          movement_type: string
          reconciled: boolean | null
          reconciliation_date: string | null
          reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          destination_account_id?: string | null
          id?: string
          movement_date?: string
          movement_type: string
          reconciled?: boolean | null
          reconciliation_date?: string | null
          reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          destination_account_id?: string | null
          id?: string
          movement_date?: string
          movement_type?: string
          reconciled?: boolean | null
          reconciliation_date?: string | null
          reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_movements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_movements_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      card_movements: {
        Row: {
          accreditation_date: string
          accredited_at: string | null
          batch_number: string | null
          card_brand: string
          card_type: string
          commission_amount: number
          commission_percentage: number
          company_id: string | null
          created_at: string | null
          gross_amount: number
          id: string
          installments: number | null
          net_amount: number
          sale_date: string
          sale_id: string | null
          status: string | null
        }
        Insert: {
          accreditation_date: string
          accredited_at?: string | null
          batch_number?: string | null
          card_brand: string
          card_type: string
          commission_amount: number
          commission_percentage: number
          company_id?: string | null
          created_at?: string | null
          gross_amount: number
          id?: string
          installments?: number | null
          net_amount: number
          sale_date: string
          sale_id?: string | null
          status?: string | null
        }
        Update: {
          accreditation_date?: string
          accredited_at?: string | null
          batch_number?: string | null
          card_brand?: string
          card_type?: string
          commission_amount?: number
          commission_percentage?: number
          company_id?: string | null
          created_at?: string | null
          gross_amount?: number
          id?: string
          installments?: number | null
          net_amount?: number
          sale_date?: string
          sale_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
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
      checks: {
        Row: {
          amount: number
          bank_name: string
          check_number: string
          company_id: string | null
          created_at: string | null
          customer_id: string | null
          due_date: string
          id: string
          issue_date: string
          notes: string | null
          status: string | null
          supplier_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_name: string
          check_number: string
          company_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          due_date: string
          id?: string
          issue_date: string
          notes?: string | null
          status?: string | null
          supplier_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_name?: string
          check_number?: string
          company_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          due_date?: string
          id?: string
          issue_date?: string
          notes?: string | null
          status?: string | null
          supplier_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_pos_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checks_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_transactions: {
        Row: {
          commission_amount: number
          commission_id: string | null
          commission_type: string
          commission_value: number
          company_id: string
          created_at: string | null
          customer_id: string | null
          id: string
          notes: string | null
          paid_at: string | null
          sale_amount: number
          sale_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          commission_amount: number
          commission_id?: string | null
          commission_type: string
          commission_value: number
          company_id: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          sale_amount: number
          sale_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          commission_amount?: number
          commission_id?: string | null
          commission_type?: string
          commission_value?: number
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          sale_amount?: number
          sale_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_transactions_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_pos_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          active: boolean | null
          applies_to: string
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          max_amount: number | null
          min_amount: number | null
          name: string
          reference_id: string | null
          type: string
          updated_at: string | null
          value: number
        }
        Insert: {
          active?: boolean | null
          applies_to: string
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          max_amount?: number | null
          min_amount?: number | null
          name: string
          reference_id?: string | null
          type: string
          updated_at?: string | null
          value: number
        }
        Update: {
          active?: boolean | null
          applies_to?: string
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          max_amount?: number | null
          min_amount?: number | null
          name?: string
          reference_id?: string | null
          type?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "commissions_company_id_fkey"
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
          autoprint_receipt: boolean | null
          backup_enabled: boolean | null
          base_price: number | null
          calculated_price: number | null
          card_surcharge_rate: number | null
          certificado_afip_url: string | null
          clave_fiscal: string | null
          condicion_iva: string | null
          created_at: string | null
          currency: string | null
          default_tax_rate: number | null
          email: string | null
          id: string
          inicio_actividades: string | null
          installment_surcharge: Json | null
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
          max_discount_percentage: number | null
          max_installments: number | null
          modules_price: number | null
          monthly_invoice_volume: number | null
          name: string
          nombre_fantasia: string | null
          phone: string | null
          razon_social: string | null
          receipt_footer: string | null
          receipt_format: string | null
          receipt_printer_name: string | null
          require_customer_document: boolean | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          subscription_type: string | null
          tax_id: string | null
          updated_at: string | null
          volume_price: number | null
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          autoprint_receipt?: boolean | null
          backup_enabled?: boolean | null
          base_price?: number | null
          calculated_price?: number | null
          card_surcharge_rate?: number | null
          certificado_afip_url?: string | null
          clave_fiscal?: string | null
          condicion_iva?: string | null
          created_at?: string | null
          currency?: string | null
          default_tax_rate?: number | null
          email?: string | null
          id?: string
          inicio_actividades?: string | null
          installment_surcharge?: Json | null
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
          max_discount_percentage?: number | null
          max_installments?: number | null
          modules_price?: number | null
          monthly_invoice_volume?: number | null
          name: string
          nombre_fantasia?: string | null
          phone?: string | null
          razon_social?: string | null
          receipt_footer?: string | null
          receipt_format?: string | null
          receipt_printer_name?: string | null
          require_customer_document?: boolean | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_type?: string | null
          tax_id?: string | null
          updated_at?: string | null
          volume_price?: number | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          autoprint_receipt?: boolean | null
          backup_enabled?: boolean | null
          base_price?: number | null
          calculated_price?: number | null
          card_surcharge_rate?: number | null
          certificado_afip_url?: string | null
          clave_fiscal?: string | null
          condicion_iva?: string | null
          created_at?: string | null
          currency?: string | null
          default_tax_rate?: number | null
          email?: string | null
          id?: string
          inicio_actividades?: string | null
          installment_surcharge?: Json | null
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
          max_discount_percentage?: number | null
          max_installments?: number | null
          modules_price?: number | null
          monthly_invoice_volume?: number | null
          name?: string
          nombre_fantasia?: string | null
          phone?: string | null
          razon_social?: string | null
          receipt_footer?: string | null
          receipt_format?: string | null
          receipt_printer_name?: string | null
          require_customer_document?: boolean | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_type?: string | null
          tax_id?: string | null
          updated_at?: string | null
          volume_price?: number | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      company_modules: {
        Row: {
          activated_at: string | null
          active: boolean | null
          company_id: string
          created_at: string | null
          deactivated_at: string | null
          id: string
          module_id: string
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          active?: boolean | null
          company_id: string
          created_at?: string | null
          deactivated_at?: string | null
          id?: string
          module_id: string
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          deactivated_at?: string | null
          id?: string
          module_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_modules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      company_onboarding: {
        Row: {
          afip_configured: boolean | null
          company_id: string
          company_info_completed: boolean | null
          completed_at: string | null
          completion_percentage: number | null
          created_at: string | null
          first_customer_added: boolean | null
          first_product_added: boolean | null
          first_sale_completed: boolean | null
          id: string
          is_active: boolean | null
          last_activity_at: string | null
          notes: string | null
          payment_method_configured: boolean | null
          started_at: string | null
          team_members_invited: boolean | null
          updated_at: string | null
        }
        Insert: {
          afip_configured?: boolean | null
          company_id: string
          company_info_completed?: boolean | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          first_customer_added?: boolean | null
          first_product_added?: boolean | null
          first_sale_completed?: boolean | null
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          notes?: string | null
          payment_method_configured?: boolean | null
          started_at?: string | null
          team_members_invited?: boolean | null
          updated_at?: string | null
        }
        Update: {
          afip_configured?: boolean | null
          company_id?: string
          company_info_completed?: boolean | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          first_customer_added?: boolean | null
          first_product_added?: boolean | null
          first_sale_completed?: boolean | null
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          notes?: string | null
          payment_method_configured?: boolean | null
          started_at?: string | null
          team_members_invited?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_onboarding_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_subscriptions: {
        Row: {
          amount_due: number | null
          base_price: number | null
          billing_cycle: string | null
          calculated_price: number | null
          company_id: string
          created_at: string | null
          end_date: string | null
          id: string
          last_payment_date: string | null
          modules_price: number | null
          monthly_invoice_volume: number | null
          next_payment_date: string | null
          plan_id: string | null
          price_breakdown: Json | null
          pricing_details: Json | null
          start_date: string | null
          status: string
          updated_at: string | null
          volume_price: number | null
        }
        Insert: {
          amount_due?: number | null
          base_price?: number | null
          billing_cycle?: string | null
          calculated_price?: number | null
          company_id: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          last_payment_date?: string | null
          modules_price?: number | null
          monthly_invoice_volume?: number | null
          next_payment_date?: string | null
          plan_id?: string | null
          price_breakdown?: Json | null
          pricing_details?: Json | null
          start_date?: string | null
          status?: string
          updated_at?: string | null
          volume_price?: number | null
        }
        Update: {
          amount_due?: number | null
          base_price?: number | null
          billing_cycle?: string | null
          calculated_price?: number | null
          company_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          last_payment_date?: string | null
          modules_price?: number | null
          monthly_invoice_volume?: number | null
          next_payment_date?: string | null
          plan_id?: string | null
          price_breakdown?: Json | null
          pricing_details?: Json | null
          start_date?: string | null
          status?: string
          updated_at?: string | null
          volume_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
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
      comprobantes_afip: {
        Row: {
          cae: string | null
          company_id: string
          created_at: string | null
          estado: string | null
          fecha_emision: string | null
          fecha_vencimiento_cae: string | null
          id: string
          importe_total: number
          numero_completo: string
          numero_comprobante: number
          observaciones: string | null
          pos_afip_id: string
          punto_venta: number
          response_afip: Json | null
          sale_id: string | null
          tipo_comprobante: string
        }
        Insert: {
          cae?: string | null
          company_id: string
          created_at?: string | null
          estado?: string | null
          fecha_emision?: string | null
          fecha_vencimiento_cae?: string | null
          id?: string
          importe_total: number
          numero_completo: string
          numero_comprobante: number
          observaciones?: string | null
          pos_afip_id: string
          punto_venta: number
          response_afip?: Json | null
          sale_id?: string | null
          tipo_comprobante: string
        }
        Update: {
          cae?: string | null
          company_id?: string
          created_at?: string | null
          estado?: string | null
          fecha_emision?: string | null
          fecha_vencimiento_cae?: string | null
          id?: string
          importe_total?: number
          numero_completo?: string
          numero_comprobante?: number
          observaciones?: string | null
          pos_afip_id?: string
          punto_venta?: number
          response_afip?: Json | null
          sale_id?: string | null
          tipo_comprobante?: string
        }
        Relationships: [
          {
            foreignKeyName: "comprobantes_afip_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprobantes_afip_pos_afip_id_fkey"
            columns: ["pos_afip_id"]
            isOneToOne: false
            referencedRelation: "pos_afip"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprobantes_afip_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
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
          condicion_iva: string | null
          created_at: string
          credit_limit: number | null
          current_balance: number | null
          document: string | null
          email: string | null
          id: string
          loyalty_points: number | null
          loyalty_tier: string | null
          name: string
          numero_documento: string | null
          payment_terms: string | null
          phone: string | null
          price_list_id: string | null
          tipo_documento: string | null
          total_purchases: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          condicion_iva?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number | null
          document?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          loyalty_tier?: string | null
          name: string
          numero_documento?: string | null
          payment_terms?: string | null
          phone?: string | null
          price_list_id?: string | null
          tipo_documento?: string | null
          total_purchases?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string | null
          condicion_iva?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number | null
          document?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          loyalty_tier?: string | null
          name?: string
          numero_documento?: string | null
          payment_terms?: string | null
          phone?: string | null
          price_list_id?: string | null
          tipo_documento?: string | null
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
          {
            foreignKeyName: "customers_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_items: {
        Row: {
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "delivery_note_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      employees: {
        Row: {
          active: boolean | null
          address: string | null
          base_salary: number
          company_id: string | null
          created_at: string | null
          department: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          first_name: string
          hire_date: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          position: string | null
          salary_type: string | null
          termination_date: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          base_salary?: number
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          first_name: string
          hire_date: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          salary_type?: string | null
          termination_date?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          base_salary?: number
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          first_name?: string
          hire_date?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          salary_type?: string | null
          termination_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rate_history: {
        Row: {
          changed_at: string | null
          company_id: string
          currency: string
          id: string
          new_rate: number
          old_rate: number | null
          source: string
        }
        Insert: {
          changed_at?: string | null
          company_id: string
          currency: string
          id?: string
          new_rate: number
          old_rate?: number | null
          source: string
        }
        Update: {
          changed_at?: string | null
          company_id?: string
          currency?: string
          id?: string
          new_rate?: number
          old_rate?: number | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rate_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rate_settings: {
        Row: {
          auto_update: boolean | null
          company_id: string
          created_at: string | null
          id: string
          last_update: string | null
          source: string | null
          update_frequency: string | null
          updated_at: string | null
        }
        Insert: {
          auto_update?: boolean | null
          company_id: string
          created_at?: string | null
          id?: string
          last_update?: string | null
          source?: string | null
          update_frequency?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_update?: boolean | null
          company_id?: string
          created_at?: string | null
          id?: string
          last_update?: string | null
          source?: string | null
          update_frequency?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rate_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
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
      integration_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          integration_id: string | null
          message: string | null
          status: string
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          integration_id?: string | null
          message?: string | null
          status: string
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          integration_id?: string | null
          message?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_orders: {
        Row: {
          company_id: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          error_message: string | null
          external_order_id: string
          id: string
          integration_id: string | null
          order_data: Json
          processed_at: string | null
          quotation_id: string | null
          sale_id: string | null
          status: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          error_message?: string | null
          external_order_id: string
          id?: string
          integration_id?: string | null
          order_data: Json
          processed_at?: string | null
          quotation_id?: string | null
          sale_id?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          error_message?: string | null
          external_order_id?: string
          id?: string
          integration_id?: string | null
          order_data?: Json
          processed_at?: string | null
          quotation_id?: string | null
          sale_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_orders_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          active: boolean | null
          auto_email: boolean | null
          auto_invoice: boolean | null
          company_id: string | null
          config: Json | null
          created_at: string | null
          credentials: Json | null
          id: string
          integration_type: string
          last_sync_at: string | null
          name: string
          sync_frequency: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          auto_email?: boolean | null
          auto_invoice?: boolean | null
          company_id?: string | null
          config?: Json | null
          created_at?: string | null
          credentials?: Json | null
          id?: string
          integration_type: string
          last_sync_at?: string | null
          name: string
          sync_frequency?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          auto_email?: boolean | null
          auto_invoice?: boolean | null
          company_id?: string | null
          config?: Json | null
          created_at?: string | null
          credentials?: Json | null
          id?: string
          integration_type?: string
          last_sync_at?: string | null
          name?: string
          sync_frequency?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      notification_preferences: {
        Row: {
          company_id: string | null
          created_at: string | null
          daily_summary: boolean | null
          email_enabled: boolean | null
          expiring_checks: boolean | null
          expiring_products: boolean | null
          id: string
          inactive_customers: boolean | null
          low_stock: boolean | null
          overdue_invoices: boolean | null
          updated_at: string | null
          user_id: string | null
          weekly_summary: boolean | null
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          daily_summary?: boolean | null
          email_enabled?: boolean | null
          expiring_checks?: boolean | null
          expiring_products?: boolean | null
          id?: string
          inactive_customers?: boolean | null
          low_stock?: boolean | null
          overdue_invoices?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          weekly_summary?: boolean | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          daily_summary?: boolean | null
          email_enabled?: boolean | null
          expiring_checks?: boolean | null
          expiring_products?: boolean | null
          id?: string
          inactive_customers?: boolean | null
          low_stock?: boolean | null
          overdue_invoices?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          weekly_summary?: boolean | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      payroll_concepts: {
        Row: {
          active: boolean | null
          calculation_type: string | null
          code: string
          company_id: string | null
          concept_type: string
          created_at: string | null
          default_value: number | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          calculation_type?: string | null
          code: string
          company_id?: string | null
          concept_type: string
          created_at?: string | null
          default_value?: number | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          calculation_type?: string | null
          code?: string
          company_id?: string | null
          concept_type?: string
          created_at?: string | null
          default_value?: number | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_concepts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_liquidation_items: {
        Row: {
          concept_code: string
          concept_id: string | null
          concept_name: string
          concept_type: string
          created_at: string | null
          id: string
          liquidation_id: string | null
          quantity: number | null
          total_amount: number
          unit_value: number
        }
        Insert: {
          concept_code: string
          concept_id?: string | null
          concept_name: string
          concept_type: string
          created_at?: string | null
          id?: string
          liquidation_id?: string | null
          quantity?: number | null
          total_amount: number
          unit_value: number
        }
        Update: {
          concept_code?: string
          concept_id?: string | null
          concept_name?: string
          concept_type?: string
          created_at?: string | null
          id?: string
          liquidation_id?: string | null
          quantity?: number | null
          total_amount?: number
          unit_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_liquidation_items_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "payroll_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_liquidation_items_liquidation_id_fkey"
            columns: ["liquidation_id"]
            isOneToOne: false
            referencedRelation: "payroll_liquidations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_liquidations: {
        Row: {
          approved_by: string | null
          base_salary: number
          company_id: string | null
          created_at: string | null
          created_by: string
          employee_id: string | null
          id: string
          net_salary: number | null
          notes: string | null
          paid_at: string | null
          period_month: number
          period_year: number
          status: string | null
          total_deductions: number | null
          total_non_remunerative: number | null
          total_remunerative: number | null
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          base_salary?: number
          company_id?: string | null
          created_at?: string | null
          created_by: string
          employee_id?: string | null
          id?: string
          net_salary?: number | null
          notes?: string | null
          paid_at?: string | null
          period_month: number
          period_year: number
          status?: string | null
          total_deductions?: number | null
          total_non_remunerative?: number | null
          total_remunerative?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          base_salary?: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string
          employee_id?: string | null
          id?: string
          net_salary?: number | null
          notes?: string | null
          paid_at?: string | null
          period_month?: number
          period_year?: number
          status?: string | null
          total_deductions?: number | null
          total_non_remunerative?: number | null
          total_remunerative?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_liquidations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_liquidations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string
          id: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_feedback: {
        Row: {
          admin_notes: string | null
          category: string
          company_id: string
          created_at: string | null
          id: string
          message: string
          rating: number | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          category: string
          company_id: string
          created_at?: string | null
          id?: string
          message: string
          rating?: number | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          company_id?: string
          created_at?: string | null
          id?: string
          message?: string
          rating?: number | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_modules: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_base_module: boolean | null
          name: string
          price_annual: number
          price_monthly: number
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_base_module?: boolean | null
          name: string
          price_annual?: number
          price_monthly?: number
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_base_module?: boolean | null
          name?: string
          price_annual?: number
          price_monthly?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_notifications: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          message: string
          notification_type: string
          read: boolean | null
          severity: string
          title: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          message: string
          notification_type: string
          read?: boolean | null
          severity?: string
          title: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          message?: string
          notification_type?: string
          read?: boolean | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          currency: string
          due_date: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          status: string
          subscription_id: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          status?: string
          subscription_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          status?: string
          subscription_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "company_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_pricing_config: {
        Row: {
          annual_discount_percentage: number
          base_package_price_annual: number
          base_package_price_monthly: number
          created_at: string | null
          id: string
          invoice_volume_tiers: Json
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          annual_discount_percentage?: number
          base_package_price_annual?: number
          base_package_price_monthly?: number
          created_at?: string | null
          id?: string
          invoice_volume_tiers?: Json
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          annual_discount_percentage?: number
          base_package_price_annual?: number
          base_package_price_monthly?: number
          created_at?: string | null
          id?: string
          invoice_volume_tiers?: Json
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pos_afip: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          descripcion: string
          id: string
          prefijo: string | null
          punto_venta: number
          tipo_comprobante: string
          ubicacion: string | null
          ultimo_numero: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          descripcion: string
          id?: string
          prefijo?: string | null
          punto_venta: number
          tipo_comprobante?: string
          ubicacion?: string | null
          ultimo_numero?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          descripcion?: string
          id?: string
          prefijo?: string | null
          punto_venta?: number
          tipo_comprobante?: string
          ubicacion?: string | null
          ultimo_numero?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_afip_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_components: {
        Row: {
          combo_product_id: string
          company_id: string
          component_product_id: string
          created_at: string
          id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          combo_product_id: string
          company_id: string
          component_product_id: string
          created_at?: string
          id?: string
          quantity: number
          updated_at?: string
        }
        Update: {
          combo_product_id?: string
          company_id?: string
          component_product_id?: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_components_combo_product_id_fkey"
            columns: ["combo_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          created_at: string
          id: string
          price: number
          price_list_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          price: number
          price_list_id: string
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          price_list_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          company_id: string
          cost: number | null
          created_at: string
          description: string | null
          expiration_date: string | null
          id: string
          image_url: string | null
          is_combo: boolean
          last_restock_date: string | null
          location: string | null
          min_stock: number | null
          name: string
          price: number
          reorder_point: number | null
          sku: string | null
          stock: number
          stock_physical: number
          stock_reserved: number
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          barcode?: string | null
          batch_number?: string | null
          category?: string | null
          company_id: string
          cost?: number | null
          created_at?: string
          description?: string | null
          expiration_date?: string | null
          id?: string
          image_url?: string | null
          is_combo?: boolean
          last_restock_date?: string | null
          location?: string | null
          min_stock?: number | null
          name: string
          price?: number
          reorder_point?: number | null
          sku?: string | null
          stock?: number
          stock_physical?: number
          stock_reserved?: number
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          barcode?: string | null
          batch_number?: string | null
          category?: string | null
          company_id?: string
          cost?: number | null
          created_at?: string
          description?: string | null
          expiration_date?: string | null
          id?: string
          image_url?: string | null
          is_combo?: boolean
          last_restock_date?: string | null
          location?: string | null
          min_stock?: number | null
          name?: string
          price?: number
          reorder_point?: number | null
          sku?: string | null
          stock?: number
          stock_physical?: number
          stock_reserved?: number
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
          notification_email: boolean | null
          notification_expiring_checks: boolean | null
          notification_expiring_products: boolean | null
          notification_inactive_customers: boolean | null
          notification_low_stock: boolean | null
          notification_overdue_invoices: boolean | null
          notification_whatsapp: boolean | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          notification_email?: boolean | null
          notification_expiring_checks?: boolean | null
          notification_expiring_products?: boolean | null
          notification_inactive_customers?: boolean | null
          notification_low_stock?: boolean | null
          notification_overdue_invoices?: boolean | null
          notification_whatsapp?: boolean | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          notification_email?: boolean | null
          notification_expiring_checks?: boolean | null
          notification_expiring_products?: boolean | null
          notification_inactive_customers?: boolean | null
          notification_low_stock?: boolean | null
          notification_overdue_invoices?: boolean | null
          notification_whatsapp?: boolean | null
          updated_at?: string
          whatsapp_number?: string | null
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
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "purchase_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "quotation_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "reservation_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "reservation_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      retentions: {
        Row: {
          amount: number
          certificate_number: string | null
          company_id: string | null
          created_at: string | null
          customer_id: string | null
          description: string | null
          id: string
          jurisdiction: string | null
          percentage: number
          purchase_id: string | null
          retention_date: string
          retention_type: string
          sale_id: string | null
          supplier_id: string | null
        }
        Insert: {
          amount: number
          certificate_number?: string | null
          company_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          jurisdiction?: string | null
          percentage: number
          purchase_id?: string | null
          retention_date: string
          retention_type: string
          sale_id?: string | null
          supplier_id?: string | null
        }
        Update: {
          amount?: number
          certificate_number?: string | null
          company_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          jurisdiction?: string | null
          percentage?: number
          purchase_id?: string | null
          retention_date?: string
          retention_type?: string
          sale_id?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retentions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retentions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_pos_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retentions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retentions_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retentions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retentions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "return_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
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
          company_id: string
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
          company_id?: string
          created_at?: string | null
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "sale_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
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
          company_id: string
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
          company_id?: string
          created_at?: string | null
          id?: string
          installments?: number | null
          notes?: string | null
          payment_method?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          cae: string | null
          company_id: string | null
          condicion_iva_cliente: string | null
          created_at: string
          customer_id: string | null
          discount: number | null
          discount_rate: number | null
          fecha_vencimiento_cae: string | null
          id: string
          installment_amount: number | null
          installments: number | null
          notes: string | null
          numero_comprobante: string | null
          payment_method: string
          pos_afip_id: string | null
          sale_number: string
          status: string | null
          subtotal: number
          tax: number | null
          tax_rate: number | null
          tipo_comprobante: string | null
          total: number
          user_id: string
          warehouse_id: string | null
        }
        Insert: {
          cae?: string | null
          company_id?: string | null
          condicion_iva_cliente?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          discount_rate?: number | null
          fecha_vencimiento_cae?: string | null
          id?: string
          installment_amount?: number | null
          installments?: number | null
          notes?: string | null
          numero_comprobante?: string | null
          payment_method: string
          pos_afip_id?: string | null
          sale_number: string
          status?: string | null
          subtotal?: number
          tax?: number | null
          tax_rate?: number | null
          tipo_comprobante?: string | null
          total: number
          user_id: string
          warehouse_id?: string | null
        }
        Update: {
          cae?: string | null
          company_id?: string | null
          condicion_iva_cliente?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          discount_rate?: number | null
          fecha_vencimiento_cae?: string | null
          id?: string
          installment_amount?: number | null
          installments?: number | null
          notes?: string | null
          numero_comprobante?: string | null
          payment_method?: string
          pos_afip_id?: string | null
          sale_number?: string
          status?: string | null
          subtotal?: number
          tax?: number | null
          tax_rate?: number | null
          tipo_comprobante?: string | null
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
            foreignKeyName: "sales_pos_afip_id_fkey"
            columns: ["pos_afip_id"]
            isOneToOne: false
            referencedRelation: "pos_afip"
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
      stock_reservations: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reservation_type: string
          reserved_by: string
          reserved_for: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reservation_type?: string
          reserved_by: string
          reserved_for?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reservation_type?: string
          reserved_by?: string
          reserved_for?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean | null
          billing_period: string
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          max_products: number | null
          max_users: number | null
          name: string
          price: number
        }
        Insert: {
          active?: boolean | null
          billing_period?: string
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          max_products?: number | null
          max_users?: number | null
          name: string
          price?: number
        }
        Update: {
          active?: boolean | null
          billing_period?: string
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          max_products?: number | null
          max_users?: number | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      supplier_payments: {
        Row: {
          amount: number
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "supplier_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      support_ticket_responses: {
        Row: {
          created_at: string | null
          id: string
          is_internal: boolean | null
          message: string
          ticket_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          message: string
          ticket_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          message?: string
          ticket_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_responses_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          priority: string
          resolved_at: string | null
          status: string
          ticket_number: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          ticket_number: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          ticket_number?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
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
          stock_physical: number
          stock_reserved: number
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
          stock_physical?: number
          stock_reserved?: number
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
          stock_physical?: number
          stock_reserved?: number
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
          company_id: string
          created_at: string | null
          id: string
          product_id: string
          product_name: string
          quantity: number
          transfer_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          product_id: string
          product_name: string
          quantity: number
          transfer_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_transfer_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          condicion_iva: string | null
          credit_limit: number | null
          current_balance: number | null
          id: string | null
          loyalty_points: number | null
          loyalty_tier: string | null
          name: string | null
          price_list_id: string | null
        }
        Insert: {
          condicion_iva?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          id?: string | null
          loyalty_points?: number | null
          loyalty_tier?: string | null
          name?: string | null
          price_list_id?: string | null
        }
        Update: {
          condicion_iva?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          id?: string | null
          loyalty_points?: number | null
          loyalty_tier?: string | null
          name?: string | null
          price_list_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
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
      calculate_subscription_price:
        | {
            Args: { p_company_id: string; p_subscription_type?: string }
            Returns: {
              base_price: number
              modules_price: number
              total_price: number
              volume_price: number
            }[]
          }
        | {
            Args: { p_billing_cycle?: string; p_company_id: string }
            Returns: Json
          }
        | {
            Args: {
              p_billing_cycle?: string
              p_company_id: string
              p_invoice_volume?: number
            }
            Returns: {
              base_price: number
              breakdown: Json
              modules_price: number
              total_price: number
              volume_price: number
            }[]
          }
      check_expiring_checks: { Args: never; Returns: undefined }
      check_expiring_products: { Args: never; Returns: undefined }
      check_inactive_customers: { Args: never; Returns: undefined }
      check_low_stock_alerts: { Args: never; Returns: undefined }
      check_overdue_invoices: { Args: never; Returns: undefined }
      check_overdue_subscriptions: { Args: never; Returns: undefined }
      create_company_with_admin: {
        Args: {
          company_address?: string
          company_name: string
          company_phone?: string
          company_tax_id?: string
        }
        Returns: string
      }
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
      expire_old_reservations: { Args: never; Returns: undefined }
      format_comprobante_number: {
        Args: { _numero: number; _punto_venta: number }
        Returns: string
      }
      generate_credit_note_number: { Args: never; Returns: string }
      generate_delivery_number: { Args: never; Returns: string }
      generate_expense_number: { Args: never; Returns: string }
      generate_quotation_number: { Args: never; Returns: string }
      generate_reservation_number: { Args: never; Returns: string }
      generate_return_number: { Args: never; Returns: string }
      generate_service_number: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
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
      get_combo_available_stock: {
        Args: { p_combo_product_id: string }
        Returns: number
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
      get_next_comprobante_number: {
        Args: { _pos_afip_id: string }
        Returns: number
      }
      get_user_companies: {
        Args: { _user_id: string }
        Returns: {
          company_id: string
        }[]
      }
      get_user_company: { Args: { _user_id: string }; Returns: string }
      get_users_to_notify: {
        Args: {
          _company_id: string
          _notification_type: string
          _roles?: Database["public"]["Enums"]["app_role"][]
        }
        Returns: {
          email: string
          email_enabled: boolean
          full_name: string
          user_id: string
          whatsapp_enabled: boolean
          whatsapp_number: string
        }[]
      }
      has_permission:
        | {
            Args: {
              _company_id?: string
              _module: string
              _permission: string
              _user_id: string
            }
            Returns: boolean
          }
        | {
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
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      setup_accountant_permissions: {
        Args: { company_uuid: string }
        Returns: undefined
      }
      toggle_company_module: {
        Args: {
          p_active?: boolean
          p_company_id: string
          p_module_code: string
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
        | "platform_admin"
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
        "platform_admin",
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
