export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      ad_advertisers: {
        Row: {
          balance: number;
          company_name: string;
          contact_phone: string | null;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          balance?: number;
          company_name: string;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          company_name?: string;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ad_campaigns: {
        Row: {
          advertiser_id: string;
          audience: string;
          bill_model: string;
          budget: number;
          cpc: number;
          cpm: number;
          created_at: string;
          hour_end: number;
          hour_start: number;
          id: string;
          is_sponsored_offer: boolean;
          name: string;
          placement: Database["public"]["Enums"]["ad_placement"];
          spent: number;
          status: Database["public"]["Enums"]["ad_status"];
          updated_at: string;
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null;
          zone_id: string | null;
        };
        Insert: {
          advertiser_id: string;
          audience?: string;
          bill_model?: string;
          budget?: number;
          cpc?: number;
          cpm?: number;
          created_at?: string;
          hour_end?: number;
          hour_start?: number;
          id?: string;
          is_sponsored_offer?: boolean;
          name: string;
          placement: Database["public"]["Enums"]["ad_placement"];
          spent?: number;
          status?: Database["public"]["Enums"]["ad_status"];
          updated_at?: string;
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null;
          zone_id?: string | null;
        };
        Update: {
          advertiser_id?: string;
          audience?: string;
          bill_model?: string;
          budget?: number;
          cpc?: number;
          cpm?: number;
          created_at?: string;
          hour_end?: number;
          hour_start?: number;
          id?: string;
          is_sponsored_offer?: boolean;
          name?: string;
          placement?: Database["public"]["Enums"]["ad_placement"];
          spent?: number;
          status?: Database["public"]["Enums"]["ad_status"];
          updated_at?: string;
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null;
          zone_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_advertiser_id_fkey";
            columns: ["advertiser_id"];
            isOneToOne: false;
            referencedRelation: "ad_advertisers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ad_campaigns_zone_id_fkey";
            columns: ["zone_id"];
            isOneToOne: false;
            referencedRelation: "fare_zones";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_clicks: {
        Row: {
          campaign_id: string;
          created_at: string;
          creative_id: string | null;
          id: string;
          placement: Database["public"]["Enums"]["ad_placement"];
          user_id: string | null;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          creative_id?: string | null;
          id?: string;
          placement: Database["public"]["Enums"]["ad_placement"];
          user_id?: string | null;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          creative_id?: string | null;
          id?: string;
          placement?: Database["public"]["Enums"]["ad_placement"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_clicks_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "ad_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ad_clicks_creative_id_fkey";
            columns: ["creative_id"];
            isOneToOne: false;
            referencedRelation: "ad_creatives";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_creatives: {
        Row: {
          body: string | null;
          campaign_id: string;
          created_at: string;
          cta_label: string | null;
          destination_url: string | null;
          headline: string;
          id: string;
          image_url: string | null;
        };
        Insert: {
          body?: string | null;
          campaign_id: string;
          created_at?: string;
          cta_label?: string | null;
          destination_url?: string | null;
          headline: string;
          id?: string;
          image_url?: string | null;
        };
        Update: {
          body?: string | null;
          campaign_id?: string;
          created_at?: string;
          cta_label?: string | null;
          destination_url?: string | null;
          headline?: string;
          id?: string;
          image_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_creatives_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "ad_campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_impressions: {
        Row: {
          campaign_id: string;
          created_at: string;
          creative_id: string | null;
          id: string;
          placement: Database["public"]["Enums"]["ad_placement"];
          user_id: string | null;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          creative_id?: string | null;
          id?: string;
          placement: Database["public"]["Enums"]["ad_placement"];
          user_id?: string | null;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          creative_id?: string | null;
          id?: string;
          placement?: Database["public"]["Enums"]["ad_placement"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ad_impressions_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "ad_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ad_impressions_creative_id_fkey";
            columns: ["creative_id"];
            isOneToOne: false;
            referencedRelation: "ad_creatives";
            referencedColumns: ["id"];
          },
        ];
      };
      battery_returns: {
        Row: {
          battery_ref: string | null;
          created_at: string;
          credit_amount: number;
          driver_id: string;
          id: string;
        };
        Insert: {
          battery_ref?: string | null;
          created_at?: string;
          credit_amount?: number;
          driver_id: string;
          id?: string;
        };
        Update: {
          battery_ref?: string | null;
          created_at?: string;
          credit_amount?: number;
          driver_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "battery_returns_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      charging_sessions: {
        Row: {
          cost: number;
          created_at: string;
          driver_id: string;
          id: string;
          kwh: number;
          reward_amount: number;
          station_name: string;
        };
        Insert: {
          cost?: number;
          created_at?: string;
          driver_id: string;
          id?: string;
          kwh: number;
          reward_amount?: number;
          station_name: string;
        };
        Update: {
          cost?: number;
          created_at?: string;
          driver_id?: string;
          id?: string;
          kwh?: number;
          reward_amount?: number;
          station_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "charging_sessions_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      drivers: {
        Row: {
          created_at: string;
          current_lat: number | null;
          current_lng: number | null;
          docs_submitted_at: string | null;
          id: string;
          id_photo_url: string | null;
          insurance_expiry: string | null;
          insurance_photo_url: string | null;
          is_online: boolean;
          licence_number: string | null;
          licence_photo_url: string | null;
          national_id: string | null;
          operator_id: string | null;
          photo_url: string | null;
          plate_number: string | null;
          rating_avg: number;
          rating_count: number;
          review_note: string | null;
          status: Database["public"]["Enums"]["driver_status"];
          training_certified: boolean;
          updated_at: string;
          user_id: string;
          uza_score: number;
          vehicle_photo_url: string | null;
          vehicle_type: Database["public"]["Enums"]["vehicle_type"];
          vest_photo_url: string | null;
        };
        Insert: {
          created_at?: string;
          current_lat?: number | null;
          current_lng?: number | null;
          docs_submitted_at?: string | null;
          id?: string;
          id_photo_url?: string | null;
          insurance_expiry?: string | null;
          insurance_photo_url?: string | null;
          is_online?: boolean;
          licence_number?: string | null;
          licence_photo_url?: string | null;
          national_id?: string | null;
          operator_id?: string | null;
          photo_url?: string | null;
          plate_number?: string | null;
          rating_avg?: number;
          rating_count?: number;
          review_note?: string | null;
          status?: Database["public"]["Enums"]["driver_status"];
          training_certified?: boolean;
          updated_at?: string;
          user_id: string;
          uza_score?: number;
          vehicle_photo_url?: string | null;
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"];
          vest_photo_url?: string | null;
        };
        Update: {
          created_at?: string;
          current_lat?: number | null;
          current_lng?: number | null;
          docs_submitted_at?: string | null;
          id?: string;
          id_photo_url?: string | null;
          insurance_expiry?: string | null;
          insurance_photo_url?: string | null;
          is_online?: boolean;
          licence_number?: string | null;
          licence_photo_url?: string | null;
          national_id?: string | null;
          operator_id?: string | null;
          photo_url?: string | null;
          plate_number?: string | null;
          rating_avg?: number;
          rating_count?: number;
          review_note?: string | null;
          status?: Database["public"]["Enums"]["driver_status"];
          training_certified?: boolean;
          updated_at?: string;
          user_id?: string;
          uza_score?: number;
          vehicle_photo_url?: string | null;
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"];
          vest_photo_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "drivers_operator_id_fkey";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "operators";
            referencedColumns: ["id"];
          },
        ];
      };
      fare_tariffs: {
        Row: {
          active: boolean;
          base_fare: number;
          commission_rate: number;
          created_at: string;
          id: string;
          min_fare: number;
          per_km: number;
          per_minute: number;
          surge_enabled: boolean;
          surge_multiplier: number;
          updated_at: string;
          vehicle_type: Database["public"]["Enums"]["vehicle_type"];
          waiting_per_minute: number;
          zone_id: string | null;
        };
        Insert: {
          active?: boolean;
          base_fare: number;
          commission_rate?: number;
          created_at?: string;
          id?: string;
          min_fare: number;
          per_km: number;
          per_minute?: number;
          surge_enabled?: boolean;
          surge_multiplier?: number;
          updated_at?: string;
          vehicle_type: Database["public"]["Enums"]["vehicle_type"];
          waiting_per_minute?: number;
          zone_id?: string | null;
        };
        Update: {
          active?: boolean;
          base_fare?: number;
          commission_rate?: number;
          created_at?: string;
          id?: string;
          min_fare?: number;
          per_km?: number;
          per_minute?: number;
          surge_enabled?: boolean;
          surge_multiplier?: number;
          updated_at?: string;
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"];
          waiting_per_minute?: number;
          zone_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fare_tariffs_zone_id_fkey";
            columns: ["zone_id"];
            isOneToOne: false;
            referencedRelation: "fare_zones";
            referencedColumns: ["id"];
          },
        ];
      };
      fare_zones: {
        Row: {
          center_lat: number | null;
          center_lng: number | null;
          created_at: string;
          district: string | null;
          id: string;
          name: string;
          radius_km: number | null;
        };
        Insert: {
          center_lat?: number | null;
          center_lng?: number | null;
          created_at?: string;
          district?: string | null;
          id?: string;
          name: string;
          radius_km?: number | null;
        };
        Update: {
          center_lat?: number | null;
          center_lng?: number | null;
          created_at?: string;
          district?: string | null;
          id?: string;
          name?: string;
          radius_km?: number | null;
        };
        Relationships: [];
      };
      incidents: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          kind: string;
          lat: number | null;
          lng: number | null;
          reporter_id: string;
          resolved: boolean;
          trip_id: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          kind: string;
          lat?: number | null;
          lng?: number | null;
          reporter_id: string;
          resolved?: boolean;
          trip_id?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          kind?: string;
          lat?: number | null;
          lng?: number | null;
          reporter_id?: string;
          resolved?: boolean;
          trip_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "incidents_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      loan_accounts: {
        Row: {
          collateral_blocked: number;
          created_at: string;
          driver_id: string;
          id: string;
          installment_amount: number;
          installment_period: string;
          outstanding: number;
          principal: number;
          started_on: string;
          status: string;
          term_months: number;
          vehicle_id: string | null;
        };
        Insert: {
          collateral_blocked?: number;
          created_at?: string;
          driver_id: string;
          id?: string;
          installment_amount: number;
          installment_period?: string;
          outstanding: number;
          principal: number;
          started_on?: string;
          status?: string;
          term_months?: number;
          vehicle_id?: string | null;
        };
        Update: {
          collateral_blocked?: number;
          created_at?: string;
          driver_id?: string;
          id?: string;
          installment_amount?: number;
          installment_period?: string;
          outstanding?: number;
          principal?: number;
          started_on?: string;
          status?: string;
          term_months?: number;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "loan_accounts_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loan_accounts_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      loan_installments: {
        Row: {
          amount: number;
          due_date: string;
          id: string;
          loan_id: string;
          paid_amount: number;
          paid_at: string | null;
          status: string;
        };
        Insert: {
          amount: number;
          due_date: string;
          id?: string;
          loan_id: string;
          paid_amount?: number;
          paid_at?: string | null;
          status?: string;
        };
        Update: {
          amount?: number;
          due_date?: string;
          id?: string;
          loan_id?: string;
          paid_amount?: number;
          paid_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loan_installments_loan_id_fkey";
            columns: ["loan_id"];
            isOneToOne: false;
            referencedRelation: "loan_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      momo_transactions: {
        Row: {
          amount: number;
          callback_payload: Json | null;
          created_at: string;
          direction: Database["public"]["Enums"]["momo_direction"];
          external_ref: string;
          id: string;
          initiated_by: string | null;
          phone: string;
          provider: Database["public"]["Enums"]["momo_provider"];
          status: Database["public"]["Enums"]["momo_status"];
          trip_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount: number;
          callback_payload?: Json | null;
          created_at?: string;
          direction: Database["public"]["Enums"]["momo_direction"];
          external_ref: string;
          id?: string;
          initiated_by?: string | null;
          phone: string;
          provider?: Database["public"]["Enums"]["momo_provider"];
          status?: Database["public"]["Enums"]["momo_status"];
          trip_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          callback_payload?: Json | null;
          created_at?: string;
          direction?: Database["public"]["Enums"]["momo_direction"];
          external_ref?: string;
          id?: string;
          initiated_by?: string | null;
          phone?: string;
          provider?: Database["public"]["Enums"]["momo_provider"];
          status?: Database["public"]["Enums"]["momo_status"];
          trip_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      operators: {
        Row: {
          admin_user_id: string | null;
          created_at: string;
          district: string | null;
          id: string;
          kind: string;
          name: string;
        };
        Insert: {
          admin_user_id?: string | null;
          created_at?: string;
          district?: string | null;
          id?: string;
          kind?: string;
          name: string;
        };
        Update: {
          admin_user_id?: string | null;
          created_at?: string;
          district?: string | null;
          id?: string;
          kind?: string;
          name?: string;
        };
        Relationships: [];
      };
      parts_redemptions: {
        Row: {
          created_at: string;
          discount_amount: number;
          driver_id: string;
          id: string;
          item: string;
        };
        Insert: {
          created_at?: string;
          discount_amount?: number;
          driver_id: string;
          id?: string;
          item: string;
        };
        Update: {
          created_at?: string;
          discount_amount?: number;
          driver_id?: string;
          id?: string;
          item?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parts_redemptions_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      payout_batches: {
        Row: {
          created_at: string;
          created_by: string | null;
          driver_count: number;
          id: string;
          status: string;
          total_amount: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          driver_count?: number;
          id?: string;
          status?: string;
          total_amount?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          driver_count?: number;
          id?: string;
          status?: string;
          total_amount?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          language: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          language?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          language?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      ratings: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          ratee_id: string;
          rater_id: string;
          stars: number;
          trip_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          ratee_id: string;
          rater_id: string;
          stars: number;
          trip_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          ratee_id?: string;
          rater_id?: string;
          stars?: number;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ratings_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      referrals: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          referred_id: string | null;
          referrer_id: string;
          rewarded: boolean;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          referred_id?: string | null;
          referrer_id: string;
          rewarded?: boolean;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          referred_id?: string | null;
          referrer_id?: string;
          rewarded?: boolean;
        };
        Relationships: [];
      };
      riders: {
        Row: {
          created_at: string;
          id: string;
          momo_phone: string | null;
          phone_verified: boolean;
          rating_avg: number;
          rating_count: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          momo_phone?: string | null;
          phone_verified?: boolean;
          rating_avg?: number;
          rating_count?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          momo_phone?: string | null;
          phone_verified?: boolean;
          rating_avg?: number;
          rating_count?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      savings_rules: {
        Row: {
          active: boolean;
          driver_id: string;
          fixed_daily: number;
          id: string;
          percent: number;
          round_to: number;
          rule_type: Database["public"]["Enums"]["savings_rule_type"];
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          driver_id: string;
          fixed_daily?: number;
          id?: string;
          percent?: number;
          round_to?: number;
          rule_type?: Database["public"]["Enums"]["savings_rule_type"];
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          driver_id?: string;
          fixed_daily?: number;
          id?: string;
          percent?: number;
          round_to?: number;
          rule_type?: Database["public"]["Enums"]["savings_rule_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "savings_rules_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: true;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      training_records: {
        Row: {
          certificate_ref: string | null;
          completed: boolean;
          completed_at: string | null;
          course: string;
          driver_id: string;
          id: string;
        };
        Insert: {
          certificate_ref?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          course: string;
          driver_id: string;
          id?: string;
        };
        Update: {
          certificate_ref?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          course?: string;
          driver_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_records_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          event_type: string;
          id: string;
          lat: number | null;
          lng: number | null;
          meta: Json | null;
          trip_id: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          meta?: Json | null;
          trip_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          meta?: Json | null;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_events_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trips: {
        Row: {
          accepted_at: string | null;
          cancellation_fee: number;
          cancelled_by: string | null;
          cancelled_reason: string | null;
          commission_amount: number | null;
          completed_at: string | null;
          created_at: string;
          distance_km: number;
          driver_earnings: number | null;
          driver_id: string | null;
          dropoff_address: string | null;
          dropoff_lat: number;
          dropoff_lng: number;
          duration_min: number;
          final_fare: number | null;
          id: string;
          offered_driver_id: string | null;
          offered_until: string | null;
          pay_method: Database["public"]["Enums"]["pay_method"] | null;
          pay_status: Database["public"]["Enums"]["pay_status"];
          pickup_address: string | null;
          pickup_lat: number;
          pickup_lng: number;
          quoted_fare: number;
          requested_at: string;
          rider_id: string;
          share_token: string;
          start_pin: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["trip_status"];
          tariff_id: string | null;
          updated_at: string;
          vehicle_type: Database["public"]["Enums"]["vehicle_type"];
        };
        Insert: {
          accepted_at?: string | null;
          cancellation_fee?: number;
          cancelled_by?: string | null;
          cancelled_reason?: string | null;
          commission_amount?: number | null;
          completed_at?: string | null;
          created_at?: string;
          distance_km?: number;
          driver_earnings?: number | null;
          driver_id?: string | null;
          dropoff_address?: string | null;
          dropoff_lat: number;
          dropoff_lng: number;
          duration_min?: number;
          final_fare?: number | null;
          id?: string;
          offered_driver_id?: string | null;
          offered_until?: string | null;
          pay_method?: Database["public"]["Enums"]["pay_method"] | null;
          pay_status?: Database["public"]["Enums"]["pay_status"];
          pickup_address?: string | null;
          pickup_lat: number;
          pickup_lng: number;
          quoted_fare: number;
          requested_at?: string;
          rider_id: string;
          share_token?: string;
          start_pin: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["trip_status"];
          tariff_id?: string | null;
          updated_at?: string;
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"];
        };
        Update: {
          accepted_at?: string | null;
          cancellation_fee?: number;
          cancelled_by?: string | null;
          cancelled_reason?: string | null;
          commission_amount?: number | null;
          completed_at?: string | null;
          created_at?: string;
          distance_km?: number;
          driver_earnings?: number | null;
          driver_id?: string | null;
          dropoff_address?: string | null;
          dropoff_lat?: number;
          dropoff_lng?: number;
          duration_min?: number;
          final_fare?: number | null;
          id?: string;
          offered_driver_id?: string | null;
          offered_until?: string | null;
          pay_method?: Database["public"]["Enums"]["pay_method"] | null;
          pay_status?: Database["public"]["Enums"]["pay_status"];
          pickup_address?: string | null;
          pickup_lat?: number;
          pickup_lng?: number;
          quoted_fare?: number;
          requested_at?: string;
          rider_id?: string;
          share_token?: string;
          start_pin?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["trip_status"];
          tariff_id?: string | null;
          updated_at?: string;
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"];
        };
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_offered_driver_id_fkey";
            columns: ["offered_driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_tariff_id_fkey";
            columns: ["tariff_id"];
            isOneToOne: false;
            referencedRelation: "fare_tariffs";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          created_at: string;
          driver_id: string | null;
          financed: boolean;
          id: string;
          is_electric: boolean;
          make: string | null;
          model: string | null;
          photo_url: string | null;
          plate_number: string;
          vehicle_type: Database["public"]["Enums"]["vehicle_type"];
          year: number | null;
        };
        Insert: {
          created_at?: string;
          driver_id?: string | null;
          financed?: boolean;
          id?: string;
          is_electric?: boolean;
          make?: string | null;
          model?: string | null;
          photo_url?: string | null;
          plate_number: string;
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"];
          year?: number | null;
        };
        Update: {
          created_at?: string;
          driver_id?: string | null;
          financed?: boolean;
          id?: string;
          is_electric?: boolean;
          make?: string | null;
          model?: string | null;
          photo_url?: string | null;
          plate_number?: string;
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"];
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      wallet_transactions: {
        Row: {
          amount: number;
          balance_after: number;
          created_at: string;
          id: string;
          note: string | null;
          ref: string | null;
          type: Database["public"]["Enums"]["wallet_tx_type"];
          wallet_id: string;
        };
        Insert: {
          amount: number;
          balance_after?: number;
          created_at?: string;
          id?: string;
          note?: string | null;
          ref?: string | null;
          type: Database["public"]["Enums"]["wallet_tx_type"];
          wallet_id: string;
        };
        Update: {
          amount?: number;
          balance_after?: number;
          created_at?: string;
          id?: string;
          note?: string | null;
          ref?: string | null;
          type?: Database["public"]["Enums"]["wallet_tx_type"];
          wallet_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
        ];
      };
      wallets: {
        Row: {
          balance: number;
          commission_owed: number;
          created_at: string;
          currency: string;
          id: string;
          locked_savings: number;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          balance?: number;
          commission_owed?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          locked_savings?: number;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          balance?: number;
          commission_owed?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          locked_savings?: number;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_ops: { Args: { _user_id: string }; Returns: boolean };
      wallet_post: {
        Args: {
          _amount: number;
          _delta?: number;
          _note?: string;
          _owed_delta?: number;
          _owner: string;
          _ref?: string;
          _savings_delta?: number;
          _type: Database["public"]["Enums"]["wallet_tx_type"];
        };
        Returns: {
          balance: number;
          commission_owed: number;
          created_at: string;
          currency: string;
          id: string;
          locked_savings: number;
          owner_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "wallets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      ad_placement: "rider_home_banner" | "post_trip" | "receipt" | "driver_idle";
      ad_status:
        "draft" | "pending_review" | "approved" | "rejected" | "running" | "paused" | "ended";
      app_role: "admin" | "ops" | "operator" | "driver" | "rider" | "advertiser";
      driver_status: "pending" | "approved" | "suspended" | "rejected";
      momo_direction: "collection" | "disbursement";
      momo_provider: "mtn" | "airtel";
      momo_status: "pending" | "successful" | "failed";
      pay_method: "momo" | "cash";
      pay_status: "pending" | "paid" | "failed" | "cash_collected";
      savings_rule_type: "fixed_daily" | "percent_trip" | "round_up" | "none";
      trip_status:
        | "requested"
        | "accepted"
        | "arriving"
        | "started"
        | "completed"
        | "cancelled_by_rider"
        | "cancelled_by_driver"
        | "no_show";
      vehicle_type: "moto" | "cab" | "e_moto" | "delivery";
      wallet_tx_type:
        | "trip_credit"
        | "commission"
        | "commission_owed"
        | "commission_settled"
        | "savings_sweep"
        | "savings_release"
        | "topup"
        | "payout"
        | "charging_reward"
        | "parts_discount"
        | "recycling_credit"
        | "ad_spend"
        | "referral_bonus"
        | "loan_installment"
        | "cancellation_fee"
        | "cancellation_payout";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      ad_placement: ["rider_home_banner", "post_trip", "receipt", "driver_idle"],
      ad_status: ["draft", "pending_review", "approved", "rejected", "running", "paused", "ended"],
      app_role: ["admin", "ops", "operator", "driver", "rider", "advertiser"],
      driver_status: ["pending", "approved", "suspended", "rejected"],
      momo_direction: ["collection", "disbursement"],
      momo_provider: ["mtn", "airtel"],
      momo_status: ["pending", "successful", "failed"],
      pay_method: ["momo", "cash"],
      pay_status: ["pending", "paid", "failed", "cash_collected"],
      savings_rule_type: ["fixed_daily", "percent_trip", "round_up", "none"],
      trip_status: [
        "requested",
        "accepted",
        "arriving",
        "started",
        "completed",
        "cancelled_by_rider",
        "cancelled_by_driver",
        "no_show",
      ],
      vehicle_type: ["moto", "cab", "e_moto", "delivery"],
      wallet_tx_type: [
        "trip_credit",
        "commission",
        "commission_owed",
        "commission_settled",
        "savings_sweep",
        "savings_release",
        "topup",
        "payout",
        "charging_reward",
        "parts_discount",
        "recycling_credit",
        "ad_spend",
        "referral_bonus",
        "loan_installment",
        "cancellation_fee",
        "cancellation_payout",
      ],
    },
  },
} as const;
