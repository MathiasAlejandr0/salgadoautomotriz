export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      vehicles: {
        Row: {
          id: string;
          slug: string;
          brand: string;
          model: string;
          year: number;
          version: string | null;
          category: string;
          fuel: string | null;
          transmission: string | null;
          mileage: number | null;
          color: string | null;
          doors: number | null;
          engine: string | null;
          price: number;
          description: string | null;
          plate: string | null;
          stock_id: string | null;
          location: string | null;
          origin: string | null;
          status: "Disponible" | "En reserva" | "Vendido" | "Borrador";
          published: boolean;
          featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          brand: string;
          model: string;
          year: number;
          version?: string | null;
          category: string;
          fuel?: string | null;
          transmission?: string | null;
          mileage?: number | null;
          color?: string | null;
          doors?: number | null;
          engine?: string | null;
          price: number;
          description?: string | null;
          plate?: string | null;
          stock_id?: string | null;
          location?: string | null;
          origin?: string | null;
          status?: "Disponible" | "En reserva" | "Vendido" | "Borrador";
          published?: boolean;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
        Relationships: [];
      };
      vehicle_images: {
        Row: {
          id: string;
          vehicle_id: string;
          storage_path: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          storage_path: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vehicle_images"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "vehicle_images_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_leads: {
        Row: {
          id: string;
          nombre: string;
          email: string;
          telefono: string | null;
          mensaje: string | null;
          vehicle_id: string | null;
          vehicle_slug: string | null;
          created_at: string;
          read: boolean;
        };
        Insert: {
          id?: string;
          nombre: string;
          email: string;
          telefono?: string | null;
          mensaje?: string | null;
          vehicle_id?: string | null;
          vehicle_slug?: string | null;
          created_at?: string;
          read?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["contact_leads"]["Insert"]>;
        Relationships: [];
      };
      financing_leads: {
        Row: {
          id: string;
          nombre: string;
          email: string;
          telefono: string;
          vehicle_id: string | null;
          vehicle_slug: string | null;
          pie: number | null;
          plazo: number | null;
          renta: number | null;
          mensaje: string | null;
          created_at: string;
          read: boolean;
        };
        Insert: {
          id?: string;
          nombre: string;
          email: string;
          telefono: string;
          vehicle_id?: string | null;
          vehicle_slug?: string | null;
          pie?: number | null;
          plazo?: number | null;
          renta?: number | null;
          mensaje?: string | null;
          created_at?: string;
          read?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["financing_leads"]["Insert"]>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          nombre: string;
          ciudad: string | null;
          rating: number;
          texto: string;
          published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          ciudad?: string | null;
          rating: number;
          texto: string;
          published?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type VehicleImage = Database["public"]["Tables"]["vehicle_images"]["Row"];
export type ContactLead = Database["public"]["Tables"]["contact_leads"]["Row"];
export type FinancingLead = Database["public"]["Tables"]["financing_leads"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];

export type VehicleWithImages = Vehicle & {
  vehicle_images: VehicleImage[];
};
