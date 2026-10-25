
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
                },"email_campaigns": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string,"event_id": string,"id": string,"scheduled_at": string | null,"segment": string,"sent_count": number,"status": string,"subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by": string,"event_id": string,"id"?: string,"scheduled_at"?: string | null,"segment": string,"sent_count"?: number,"status"?: string,"subject": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string,"event_id"?: string,"id"?: string,"scheduled_at"?: string | null,"segment"?: string,"sent_count"?: number,"status"?: string,"subject"?: string
                  }
                  Relationships: [
                    {
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
                    "address": string | null,"capacity": number | null,"category": string,"city": string | null,"country": string | null,"country_code": string | null,"cover_theme": string,"cover_url": string | null,"created_at": string,"description": string | null,"ends_at": string | null,"id": string,"is_online": boolean,"lat": number | null,"lng": number | null,"notify_registration": boolean,"owner_id": string,"place_id": string | null,"refund_policy": string | null,"region": string | null,"registration_open": boolean,"require_approval": boolean,"show_attendee_count": boolean,"slug": string,"starts_at": string,"status": string,"timezone": string,"title": string,"updated_at": string,"venue_name": string | null,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"capacity"?: number | null,"category": string,"city"?: string | null,"country"?: string | null,"country_code"?: string | null,"cover_theme"?: string,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"is_online"?: boolean,"lat"?: number | null,"lng"?: number | null,"notify_registration"?: boolean,"owner_id": string,"place_id"?: string | null,"refund_policy"?: string | null,"region"?: string | null,"registration_open"?: boolean,"require_approval"?: boolean,"show_attendee_count"?: boolean,"slug": string,"starts_at": string,"status"?: string,"timezone"?: string,"title": string,"updated_at"?: string,"venue_name"?: string | null,"visibility"?: string
                  }
                  Update: {
                    "address"?: string | null,"capacity"?: number | null,"category"?: string,"city"?: string | null,"country"?: string | null,"country_code"?: string | null,"cover_theme"?: string,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"is_online"?: boolean,"lat"?: number | null,"lng"?: number | null,"notify_registration"?: boolean,"owner_id"?: string,"place_id"?: string | null,"refund_policy"?: string | null,"region"?: string | null,"registration_open"?: boolean,"require_approval"?: boolean,"show_attendee_count"?: boolean,"slug"?: string,"starts_at"?: string,"status"?: string,"timezone"?: string,"title"?: string,"updated_at"?: string,"venue_name"?: string | null,"visibility"?: string
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
                },"profiles": {
                  Row: {
                    "country": string | null,"created_at": string,"dashboard_theme": string,"email": string | null,"full_name": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string | null,"created_at"?: string,"dashboard_theme"?: string,"email"?: string | null,"full_name"?: string | null,"id": string
                  }
                  Update: {
                    "country"?: string | null,"created_at"?: string,"dashboard_theme"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"registrations": {
                  Row: {
                    "amount_minor": number,"answers": NonNullable<Json>,"attendee_email": string,"attendee_name": string,"checked_in_at": string | null,"checked_in_by": string | null,"created_at": string,"event_id": string,"id": string,"payment_ref": string | null,"status": string,"ticket_code": string,"tier_id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor"?: number,"answers"?: NonNullable<Json>,"attendee_email": string,"attendee_name": string,"checked_in_at"?: string | null,"checked_in_by"?: string | null,"created_at"?: string,"event_id": string,"id"?: string,"payment_ref"?: string | null,"status"?: string,"ticket_code"?: string,"tier_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "amount_minor"?: number,"answers"?: NonNullable<Json>,"attendee_email"?: string,"attendee_name"?: string,"checked_in_at"?: string | null,"checked_in_by"?: string | null,"created_at"?: string,"event_id"?: string,"id"?: string,"payment_ref"?: string | null,"status"?: string,"ticket_code"?: string,"tier_id"?: string,"user_id"?: string | null
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
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_manage_event_folder":
{ Args: { "p_name": string }; Returns: boolean
                           },
"check_in_guest":
{ Args: { "p_registration": string }; Returns: {
              "amount_minor": number,
"answers": NonNullable<Json>,
"attendee_email": string,
"attendee_name": string,
"checked_in_at": string | null,
"checked_in_by": string | null,
"created_at": string,
"event_id": string,
"id": string,
"payment_ref": string | null,
"status": string,
"ticket_code": string,
"tier_id": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "registrations"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_event_with_tiers":
{ Args: { "p_event": Json,"p_tiers": Json }; Returns: {
              "address": string | null,
"capacity": number | null,
"category": string,
"city": string | null,
"country": string | null,
"country_code": string | null,
"cover_theme": string,
"cover_url": string | null,
"created_at": string,
"description": string | null,
"ends_at": string | null,
"id": string,
"is_online": boolean,
"lat": number | null,
"lng": number | null,
"notify_registration": boolean,
"owner_id": string,
"place_id": string | null,
"refund_policy": string | null,
"region": string | null,
"registration_open": boolean,
"require_approval": boolean,
"show_attendee_count": boolean,
"slug": string,
"starts_at": string,
"status": string,
"timezone": string,
"title": string,
"updated_at": string,
"venue_name": string | null,
"visibility": string
            }
                          SetofOptions: {
        from: "*"
        to: "events"
        isOneToOne: true
        isSetofReturn: false
      } },
"delete_event":
{ Args: { "p_confirm_title": string,"p_event": string }; Returns: Json
                           },
"event_delete_check":
{ Args: { "p_event": string }; Returns: Json
                           },
"get_event_page":
{ Args: { "p_slug": string }; Returns: Json
                           },
"get_ticket":
{ Args: { "p_code": string }; Returns: Json
                           },
"has_event_role":
{ Args: { "p_event": string,"p_roles": (string)[] }; Returns: boolean
                           },
"promote_next_waitlisted":
{ Args: { "p_event": string }; Returns: {
              "amount_minor": number,
"answers": NonNullable<Json>,
"attendee_email": string,
"attendee_name": string,
"checked_in_at": string | null,
"checked_in_by": string | null,
"created_at": string,
"event_id": string,
"id": string,
"payment_ref": string | null,
"status": string,
"ticket_code": string,
"tier_id": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "registrations"
        isOneToOne: true
        isSetofReturn: false
      } },
"public_attendee_count":
{ Args: { "p_event": string }; Returns: number
                           },
"register_guest":
{ Args: { "p_answers"?: Json,"p_email": string,"p_event": string,"p_name": string,"p_tier": string }; Returns: {
              "amount_minor": number,
"answers": NonNullable<Json>,
"attendee_email": string,
"attendee_name": string,
"checked_in_at": string | null,
"checked_in_by": string | null,
"created_at": string,
"event_id": string,
"id": string,
"payment_ref": string | null,
"status": string,
"ticket_code": string,
"tier_id": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "registrations"
        isOneToOne: true
        isSetofReturn: false
      } },
"reserve_ticket":
{ Args: { "p_email": string,"p_name": string,"p_tier": string }; Returns: {
              "amount_minor": number,
"answers": NonNullable<Json>,
"attendee_email": string,
"attendee_name": string,
"checked_in_at": string | null,
"checked_in_by": string | null,
"created_at": string,
"event_id": string,
"id": string,
"payment_ref": string | null,
"status": string,
"ticket_code": string,
"tier_id": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "registrations"
        isOneToOne: true
        isSetofReturn: false
      } },
"take_places_quota":
{ Args: Record<PropertyKey, never>; Returns: boolean
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
