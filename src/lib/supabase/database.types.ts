
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"event_id": string | null,"id": number,"meta": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"event_id"?: string | null,"id"?: never,"meta"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"event_id"?: string | null,"id"?: never,"meta"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"disputes": {
                  Row: {
                    "amount_minor": number,"currency": string,"id": string,"opened_at": string,"order_id": string,"provider_dispute_id": string,"resolved_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"currency": string,"id"?: string,"opened_at"?: string,"order_id": string,"provider_dispute_id": string,"resolved_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"currency"?: string,"id"?: string,"opened_at"?: string,"order_id"?: string,"provider_dispute_id"?: string,"resolved_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "disputes_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"email_campaign_recipients": {
                  Row: {
                    "campaign_id": string,"email": string,"id": number,"name": string | null,"sent_at": string | null,"status": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_id": string,"email": string,"id"?: never,"name"?: string | null,"sent_at"?: string | null,"status"?: string,"token"?: string
                  }
                  Update: {
                    "campaign_id"?: string,"email"?: string,"id"?: never,"name"?: string | null,"sent_at"?: string | null,"status"?: string,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "email_campaigns"
      referencedColumns: ["id"]
    }
                  ]
                },"email_campaigns": {
                  Row: {
                    "body": string,"charged_to": string | null,"created_at": string,"created_by": string,"event_id": string,"id": string,"recipient_count": number,"scheduled_at": string | null,"segment": string,"sent_at": string | null,"sent_by": string | null,"sent_count": number,"status": string,"subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"charged_to"?: string | null,"created_at"?: string,"created_by": string,"event_id": string,"id"?: string,"recipient_count"?: number,"scheduled_at"?: string | null,"segment": string,"sent_at"?: string | null,"sent_by"?: string | null,"sent_count"?: number,"status"?: string,"subject": string
                  }
                  Update: {
                    "body"?: string,"charged_to"?: string | null,"created_at"?: string,"created_by"?: string,"event_id"?: string,"id"?: string,"recipient_count"?: number,"scheduled_at"?: string | null,"segment"?: string,"sent_at"?: string | null,"sent_by"?: string | null,"sent_count"?: number,"status"?: string,"subject"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_campaigns_charged_to_fkey"
      columns: ["charged_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_campaigns_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_campaigns_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_campaigns_sent_by_fkey"
      columns: ["sent_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"email_suppressions": {
                  Row: {
                    "created_at": string,"email": string,"event_id": string | null,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"event_id"?: string | null,"reason": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"event_id"?: string | null,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_suppressions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_members": {
                  Row: {
                    "accepted_at": string | null,"event_id": string,"invited_at": string,"invited_email": string | null,"role": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"event_id": string,"invited_at"?: string,"invited_email"?: string | null,"role": string,"user_id"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"event_id"?: string,"invited_at"?: string,"invited_email"?: string | null,"role"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_members_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_questions": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"kind": string,"label": string,"options": (string)[],"position": number,"required": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"kind": string,"label": string,"options"?: (string)[],"position"?: number,"required"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"kind"?: string,"label"?: string,"options"?: (string)[],"position"?: number,"required"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_questions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "active_count": number,"address": string | null,"capacity": number | null,"category": string,"city": string | null,"country": string | null,"country_code": string | null,"cover_theme": string,"cover_url": string | null,"created_at": string,"description": string | null,"ends_at": string | null,"fee_choice": string,"id": string,"is_online": boolean,"lat": number | null,"lng": number | null,"maps_url": string | null,"notify_registration": boolean,"owner_id": string,"payment_country": string | null,"per_buyer_limit": number,"place_id": string | null,"refund_policy": string | null,"region": string | null,"registration_open": boolean,"require_approval": boolean,"show_attendee_count": boolean,"slug": string,"starts_at": string,"status": string,"timezone": string,"title": string,"updated_at": string,"venue_name": string | null,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active_count"?: number,"address"?: string | null,"capacity"?: number | null,"category": string,"city"?: string | null,"country"?: string | null,"country_code"?: string | null,"cover_theme"?: string,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at"?: string | null,"fee_choice"?: string,"id"?: string,"is_online"?: boolean,"lat"?: number | null,"lng"?: number | null,"maps_url"?: string | null,"notify_registration"?: boolean,"owner_id": string,"payment_country"?: string | null,"per_buyer_limit"?: number,"place_id"?: string | null,"refund_policy"?: string | null,"region"?: string | null,"registration_open"?: boolean,"require_approval"?: boolean,"show_attendee_count"?: boolean,"slug": string,"starts_at": string,"status"?: string,"timezone"?: string,"title": string,"updated_at"?: string,"venue_name"?: string | null,"visibility"?: string
                  }
                  Update: {
                    "active_count"?: number,"address"?: string | null,"capacity"?: number | null,"category"?: string,"city"?: string | null,"country"?: string | null,"country_code"?: string | null,"cover_theme"?: string,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at"?: string | null,"fee_choice"?: string,"id"?: string,"is_online"?: boolean,"lat"?: number | null,"lng"?: number | null,"maps_url"?: string | null,"notify_registration"?: boolean,"owner_id"?: string,"payment_country"?: string | null,"per_buyer_limit"?: number,"place_id"?: string | null,"refund_policy"?: string | null,"region"?: string | null,"registration_open"?: boolean,"require_approval"?: boolean,"show_attendee_count"?: boolean,"slug"?: string,"starts_at"?: string,"status"?: string,"timezone"?: string,"title"?: string,"updated_at"?: string,"venue_name"?: string | null,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"host_applications": {
                  Row: {
                    "account_number": string,"bank_code": string,"bank_name": string | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"document_path": string,"host_id": string,"id": string,"legal_name": string,"payout_country": string,"phone": string,"reason": string | null,"resolved_account_name": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_number": string,"bank_code": string,"bank_name"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"document_path": string,"host_id": string,"id"?: string,"legal_name": string,"payout_country": string,"phone": string,"reason"?: string | null,"resolved_account_name"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "account_number"?: string,"bank_code"?: string,"bank_name"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"document_path"?: string,"host_id"?: string,"id"?: string,"legal_name"?: string,"payout_country"?: string,"phone"?: string,"reason"?: string | null,"resolved_account_name"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "host_applications_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "host_applications_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ledger_entries": {
                  Row: {
                    "account": string,"amount_minor": number,"created_at": string,"currency": string,"dispute_id": string | null,"host_id": string | null,"id": number,"kind": string,"order_id": string | null,"reference": string | null,"refund_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account": string,"amount_minor": number,"created_at"?: string,"currency": string,"dispute_id"?: string | null,"host_id"?: string | null,"id"?: never,"kind": string,"order_id"?: string | null,"reference"?: string | null,"refund_id"?: string | null
                  }
                  Update: {
                    "account"?: string,"amount_minor"?: number,"created_at"?: string,"currency"?: string,"dispute_id"?: string | null,"host_id"?: string | null,"id"?: never,"kind"?: string,"order_id"?: string | null,"reference"?: string | null,"refund_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ledger_entries_dispute_id_fkey"
      columns: ["dispute_id"]
isOneToOne: false
      referencedRelation: "disputes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_refund_id_fkey"
      columns: ["refund_id"]
isOneToOne: false
      referencedRelation: "refunds"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "amount_minor": number,"answers": NonNullable<Json>,"buyer_id": string | null,"country": string | null,"created_at": string,"currency": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"event_id": string,"hold_expires_at": string | null,"id": string,"kind": string,"non_refundable_accepted_at": string | null,"quote": Json | null,"reference": string | null,"status": string,"ticket_count": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor"?: number,"answers"?: NonNullable<Json>,"buyer_id"?: string | null,"country"?: string | null,"created_at"?: string,"currency": string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"event_id": string,"hold_expires_at"?: string | null,"id"?: string,"kind"?: string,"non_refundable_accepted_at"?: string | null,"quote"?: Json | null,"reference"?: string | null,"status": string,"ticket_count": number,"updated_at"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"answers"?: NonNullable<Json>,"buyer_id"?: string | null,"country"?: string | null,"created_at"?: string,"currency"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"event_id"?: string,"hold_expires_at"?: string | null,"id"?: string,"kind"?: string,"non_refundable_accepted_at"?: string | null,"quote"?: Json | null,"reference"?: string | null,"status"?: string,"ticket_count"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"outbox_events": {
                  Row: {
                    "created_at": string,"dispatched_at": string | null,"event_type": string,"id": string,"job_id": string,"job_name": string,"job_queue": string,"payload": NonNullable<Json>,"run_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dispatched_at"?: string | null,"event_type": string,"id": string,"job_id": string,"job_name": string,"job_queue": string,"payload"?: NonNullable<Json>,"run_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"dispatched_at"?: string | null,"event_type"?: string,"id"?: string,"job_id"?: string,"job_name"?: string,"job_queue"?: string,"payload"?: NonNullable<Json>,"run_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "access_code": string | null,"amount_minor": number,"authorization_url": string | null,"channel": string | null,"country": string,"created_at": string,"currency": string,"id": string,"order_id": string,"provider": string,"provider_charge_minor": number | null,"provider_transaction_id": string | null,"reference": string,"status": string,"updated_at": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "access_code"?: string | null,"amount_minor": number,"authorization_url"?: string | null,"channel"?: string | null,"country": string,"created_at"?: string,"currency": string,"id"?: string,"order_id": string,"provider"?: string,"provider_charge_minor"?: number | null,"provider_transaction_id"?: string | null,"reference": string,"status"?: string,"updated_at"?: string,"verified_at"?: string | null
                  }
                  Update: {
                    "access_code"?: string | null,"amount_minor"?: number,"authorization_url"?: string | null,"channel"?: string | null,"country"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"order_id"?: string,"provider"?: string,"provider_charge_minor"?: number | null,"provider_transaction_id"?: string | null,"reference"?: string,"status"?: string,"updated_at"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"payout_accounts": {
                  Row: {
                    "account_name": string | null,"account_number": string,"activated_at": string | null,"application_id": string | null,"bank_code": string,"bank_name": string | null,"business_name": string,"country": string,"created_at": string,"currency": string,"host_id": string,"id": string,"last_error": string | null,"provider": string,"replaced_at": string | null,"status": string,"subaccount_code": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_name"?: string | null,"account_number": string,"activated_at"?: string | null,"application_id"?: string | null,"bank_code": string,"bank_name"?: string | null,"business_name": string,"country": string,"created_at"?: string,"currency": string,"host_id": string,"id"?: string,"last_error"?: string | null,"provider"?: string,"replaced_at"?: string | null,"status"?: string,"subaccount_code"?: string | null
                  }
                  Update: {
                    "account_name"?: string | null,"account_number"?: string,"activated_at"?: string | null,"application_id"?: string | null,"bank_code"?: string,"bank_name"?: string | null,"business_name"?: string,"country"?: string,"created_at"?: string,"currency"?: string,"host_id"?: string,"id"?: string,"last_error"?: string | null,"provider"?: string,"replaced_at"?: string | null,"status"?: string,"subaccount_code"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payout_accounts_application_id_fkey"
      columns: ["application_id"]
isOneToOne: false
      referencedRelation: "host_applications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payout_accounts_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"places_usage": {
                  Row: {
                    "day": string,"day_count": number,"minute_count": number,"minute_start": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"day_count": number,"minute_count": number,"minute_start": string,"user_id": string
                  }
                  Update: {
                    "day"?: string,"day_count"?: number,"minute_count"?: number,"minute_start"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_settings": {
                  Row: {
                    "key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_staff": {
                  Row: {
                    "added_at": string,"email": string,"note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"email": string,"note"?: string | null
                  }
                  Update: {
                    "added_at"?: string,"email"?: string,"note"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"platform_staff_invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"revoked_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"expires_at": string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_staff_invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "country": string | null,"created_at": string,"dashboard_theme": string,"email": string | null,"full_name": string | null,"id": string,"suspended_at": string | null,"suspended_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string | null,"created_at"?: string,"dashboard_theme"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"suspended_at"?: string | null,"suspended_reason"?: string | null
                  }
                  Update: {
                    "country"?: string | null,"created_at"?: string,"dashboard_theme"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"suspended_at"?: string | null,"suspended_reason"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"reconciliation_runs": {
                  Row: {
                    "country": string,"created_at": string,"day": string,"differences": NonNullable<Json>,"id": string,"matched": number,"provider": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country": string,"created_at"?: string,"day": string,"differences"?: NonNullable<Json>,"id"?: string,"matched"?: number,"provider": string,"status": string
                  }
                  Update: {
                    "country"?: string,"created_at"?: string,"day"?: string,"differences"?: NonNullable<Json>,"id"?: string,"matched"?: number,"provider"?: string,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"refunds": {
                  Row: {
                    "amount_minor": number,"attempts": number,"created_at": string,"currency": string,"host_debt_minor": number,"id": string,"last_error": string | null,"next_attempt_at": string | null,"order_id": string,"payment_id": string | null,"provider_refund_id": string | null,"reason": string,"requested_by": string | null,"status": string,"ticket_ids": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"attempts"?: number,"created_at"?: string,"currency": string,"host_debt_minor"?: number,"id"?: string,"last_error"?: string | null,"next_attempt_at"?: string | null,"order_id": string,"payment_id"?: string | null,"provider_refund_id"?: string | null,"reason": string,"requested_by"?: string | null,"status"?: string,"ticket_ids"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"attempts"?: number,"created_at"?: string,"currency"?: string,"host_debt_minor"?: number,"id"?: string,"last_error"?: string | null,"next_attempt_at"?: string | null,"order_id"?: string,"payment_id"?: string | null,"provider_refund_id"?: string | null,"reason"?: string,"requested_by"?: string | null,"status"?: string,"ticket_ids"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"registrations": {
                  Row: {
                    "amount_minor": number,"answers": NonNullable<Json>,"attendee_email": string,"attendee_name": string,"checked_in_at": string | null,"checked_in_by": string | null,"created_at": string,"event_id": string,"guest_name": string | null,"id": string,"order_id": string | null,"payment_ref": string | null,"status": string,"ticket_code": string,"ticket_number": number | null,"tier_id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor"?: number,"answers"?: NonNullable<Json>,"attendee_email": string,"attendee_name": string,"checked_in_at"?: string | null,"checked_in_by"?: string | null,"created_at"?: string,"event_id": string,"guest_name"?: string | null,"id"?: string,"order_id"?: string | null,"payment_ref"?: string | null,"status"?: string,"ticket_code"?: string,"ticket_number"?: number | null,"tier_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "amount_minor"?: number,"answers"?: NonNullable<Json>,"attendee_email"?: string,"attendee_name"?: string,"checked_in_at"?: string | null,"checked_in_by"?: string | null,"created_at"?: string,"event_id"?: string,"guest_name"?: string | null,"id"?: string,"order_id"?: string | null,"payment_ref"?: string | null,"status"?: string,"ticket_code"?: string,"ticket_number"?: number | null,"tier_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "registrations_checked_in_by_fkey"
      columns: ["checked_in_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "registrations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "registrations_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "registrations_tier_id_fkey"
      columns: ["tier_id"]
isOneToOne: false
      referencedRelation: "ticket_tiers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "registrations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ticket_deliveries": {
                  Row: {
                    "channel": string,"created_at": string,"destination": string,"error": string | null,"id": string,"status": string,"ticket_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"created_at"?: string,"destination": string,"error"?: string | null,"id"?: string,"status": string,"ticket_code": string
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"destination"?: string,"error"?: string | null,"id"?: string,"status"?: string,"ticket_code"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ticket_tiers": {
                  Row: {
                    "created_at": string,"currency": string,"event_id": string,"id": string,"is_active": boolean,"name": string,"price_minor": number,"quantity": number | null,"sales_end": string | null,"sales_start": string | null,"sold": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"event_id": string,"id"?: string,"is_active"?: boolean,"name": string,"price_minor"?: number,"quantity"?: number | null,"sales_end"?: string | null,"sales_start"?: string | null,"sold"?: number
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"event_id"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"price_minor"?: number,"quantity"?: number | null,"sales_end"?: string | null,"sales_start"?: string | null,"sold"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_tiers_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"waitlist_offers": {
                  Row: {
                    "event_id": string,"expires_at": string,"id": string,"offered_at": string,"order_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"expires_at": string,"id"?: string,"offered_at"?: string,"order_id": string,"status"?: string
                  }
                  Update: {
                    "event_id"?: string,"expires_at"?: string,"id"?: string,"offered_at"?: string,"order_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "waitlist_offers_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "waitlist_offers_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_inbox": {
                  Row: {
                    "attempts": number,"country": string,"event_id": string,"id": string,"outcome": string | null,"payload": NonNullable<Json>,"processed_at": string | null,"provider": string,"received_at": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"country": string,"event_id": string,"id"?: string,"outcome"?: string | null,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider": string,"received_at"?: string,"type": string
                  }
                  Update: {
                    "attempts"?: number,"country"?: string,"event_id"?: string,"id"?: string,"outcome"?: string | null,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"received_at"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_manage_event_folder":
{ Args: { "p_name": string }; Returns: boolean
                           },
"has_event_role":
{ Args: { "p_event": string,"p_roles": (string)[] }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
