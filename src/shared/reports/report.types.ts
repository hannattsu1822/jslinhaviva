/**
 * Tipos compartilhados para relatórios PDF/HTML do Linha Viva.
 * Visual alinhado a frontend/public/static/css/base/variables.css
 */

export interface ReportBrand {
  name: string;
  company: string;
  system: string;
}

export interface ReportMeta {
  title: string;
  badge?: string;
  subtitle?: string;
  processo?: string;
  generatedAt?: string;
  author?: string;
  extraMeta?: string;
  showFooterNote?: boolean;
}

export interface PdfReportOptions {
  landscape?: boolean;
  format?: "A4" | "Letter";
  margin?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  headerFooter?: boolean;
  headerMeta?: Pick<ReportMeta, "title" | "subtitle">;
}

export interface ReportField {
  label: string;
  value: string;
  fullWidth?: boolean;
}

export interface ReportTableColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
}

export type ReportStatusVariant = "success" | "error" | "warning" | "neutral";
