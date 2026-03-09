import type { ConfidenceLevel, Citation } from "./confidence";

export interface DeepDiveSection {
  key: string;
  title: string;
  content: string;
  confidence: ConfidenceLevel;
  sources: Citation[];
}

export interface DeepDive {
  topicName: string;
  domain: string;
  sections: DeepDiveSection[];
  generatedAt: string;
}
