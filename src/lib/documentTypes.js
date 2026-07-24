// lib/documentTypes.js
import { Clock, CheckCircle2, XCircle } from 'lucide-react';

export const DOCUMENT_TYPE_LABEL = {
  title_deed: 'Title deed',
  sale_agreement: 'Sale agreement',
  id_document: 'ID document',
  survey_map: 'Survey map',
  other: 'Other',
};

export const STATUS_META = {
  pending:  { label: 'Pending review', icon: Clock,        className: 'doc-status--pending' },
  verified: { label: 'Verified',       icon: CheckCircle2, className: 'doc-status--verified' },
  rejected: { label: 'Rejected',       icon: XCircle,       className: 'doc-status--rejected' },
};

export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;