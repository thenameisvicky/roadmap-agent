export interface Userdetails {
  user_id: string;
  name: string;
  goal_track: string;
  active_roadmap_id: string;
  roadmap_slug: string;
  graduation_year: number;
}

export interface Roadmap {
  id: string;
  slug: string;
  title: string;
  months: Array<{ month: number; title: string; activities: Array<string> }>;
  revision_history: Array<{ at: string; note: string }>;
  _comment: string;
}
