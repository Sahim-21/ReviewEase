export type MenuItemPublic = {
  id: number;
  name: string;
  category: string | null;
};

export interface TagPublic {
  id: number;
  label: string;
  aspect: string;
}

export type RestaurantPublic = {
  slug: string;
  name: string;
  google_place_id: string;
  brand_color: string | null;
  logo_url: string | null;
  default_lang: string;
  active: boolean;
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

export type FlowStep = "meal" | "stars" | "tags" | "notes" | "review" | "thanks";

export type RestaurantSummary = {
  id: number;
  slug: string;
  name: string;
  google_place_id: string;
  brand_color: string | null;
  active: boolean;
};

export type AdminRestaurantDetail = {
  id: number;
  slug: string;
  name: string;
  google_place_id: string;
  brand_color: string | null;
  created_at: string;
  active: boolean;
  menu: MenuItemPublic[];
  tags: TagPublic[];
};

export interface RestaurantStatusResponse {
  id: number;
  active: boolean;
}

export interface RestaurantDeletedResponse {
  deleted: boolean;
}

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
  /** Low-star (1-2) private notes and visits that need the owner's attention, newest first. */
  attention?: {
    kind: "feedback" | "session";
    id: number;
    rating: number | null;
    message: string | null;
    items: string[];
    note: string | null;
    contact: string | null;
    created_at: string;
  }[];
  /** Overall star ratings given by diners. Index 0 of `distribution` is 1 star, index 4 is 5 stars. */
  ratings?: {
    count: number;
    average: number | null;
    distribution: number[];
  };
};
