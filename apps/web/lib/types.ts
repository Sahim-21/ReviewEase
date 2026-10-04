export type MenuItemPublic = {
  id: number;
  name: string;
  category: string | null;
};

export type TagPublic = {
  id: number;
  label: string;
  aspect: string;
};

export type RestaurantPublic = {
  slug: string;
  name: string;
  google_place_id: string;
  brand_color: string | null;
  logo_url: string | null;
  default_lang: string;
  menu: MenuItemPublic[];
  tags: TagPublic[];
};

export type Tone = "casual" | "detailed" | "short";
export type OutputLang = "English" | "Hinglish" | "Hindi" | "Kannada";
export type Aspect = "food" | "service" | "ambience" | "value";
export type Ratings = Partial<Record<Aspect, number>>;

export type SessionStart = {
  id: number;
  token: string;
  expires_in: number;
};

export type DraftResponse = {
  id: number;
  text: string;
  provider: string;
  grounding_ok: boolean;
};

export type CompleteResponse = {
  id: number;
  final_text: string;
  clicked_google: boolean;
};

export type FeedbackResponse = {
  id: number;
  submitted: boolean;
};

export type FlowStep = "meal" | "notes" | "review" | "thanks";

export type RestaurantSummary = {
  id: number;
  slug: string;
  name: string;
  google_place_id: string;
  brand_color: string | null;
};

export type AdminRestaurantDetail = {
  id: number;
  slug: string;
  name: string;
  google_place_id: string;
  brand_color: string | null;
  created_at: string;
  menu: MenuItemPublic[];
  tags: TagPublic[];
};

export type OwnerMetrics = {
  restaurant_id: number;
  restaurant_name: string;
  funnel: {
    scans: number;
    started: number;
    drafts: number;
    copied: number;
    opened_google: number;
  };
  daily: { day: string; scans: number; drafts: number; opened_google: number }[];
  feedback: {
    id: number;
    message: string;
    rating: number | null;
    contact: string | null;
    created_at: string;
  }[];
};
