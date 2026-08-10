/*
  roleConfigs.js
  One config object per professional role. This is what lets the six shared
  section components stay generic while each dashboard shows the right
  labels, credential fields, and task_key.

  ASSUMPTION TO VERIFY: task_key values must match whatever keys
  EngageProfessionalsModule / StageTaskModule already use for these roles
  (mentioned as hire_lawyer / schedule_valuer / schedule_surveyor). If your
  actual key names differ, update them here only — nothing else needs to change.
*/

export const ROLE_CONFIGS = {
  lawyer: {
    role: 'lawyer',
    label: 'Lawyer',
    taskKey: 'hire_lawyer',
    dashboardTitle: 'Lawyer dashboard',
    credentialFields: [
      { key: 'license_number', label: 'LSK practising certificate no.', mono: true },
      { key: 'firm_name', label: 'Law firm / chambers' },
      { key: 'practice_areas', label: 'Practice areas (e.g. conveyancing, land disputes)' },
      { key: 'years_experience', label: 'Years in practice' },
    ],
    documentTypes: [
      { key: 'sale_agreement', label: 'Sale agreement' },
      { key: 'lease_agreement', label: 'Lease agreement' },
      { key: 'due_diligence_report', label: 'Due diligence report' },
      { key: 'legal_opinion', label: 'Legal opinion' },
      { key: 'other', label: 'Other document' },
    ],
  },
  surveyor: {
    role: 'surveyor',
    label: 'Surveyor',
    taskKey: 'schedule_surveyor',
    dashboardTitle: 'Surveyor dashboard',
    credentialFields: [
      { key: 'license_number', label: 'Surveyors Board of Kenya reg. no.', mono: true },
      { key: 'firm_name', label: 'Firm / practice name' },
      { key: 'survey_specialties', label: 'Specialties (e.g. boundary, topographic)' },
      { key: 'years_experience', label: 'Years of practice' },
    ],
    documentTypes: [
      { key: 'survey_report', label: 'Survey report' },
      { key: 'beacon_certificate', label: 'Beacon certificate' },
      { key: 'boundary_plan', label: 'Boundary plan' },
      { key: 'other', label: 'Other document' },
    ],
  },
  valuer: {
    role: 'valuer',
    label: 'Valuer',
    taskKey: 'schedule_valuer',
    dashboardTitle: 'Valuer dashboard',
    credentialFields: [
      { key: 'license_number', label: 'Valuers Registration Board no.', mono: true },
      { key: 'firm_name', label: 'Firm / practice name' },
      { key: 'valuation_specialties', label: 'Specialties (e.g. residential, land, forced-sale)' },
      { key: 'years_experience', label: 'Years of practice' },
    ],
    documentTypes: [
      { key: 'valuation_report', label: 'Valuation report' },
      { key: 'inspection_notes', label: 'Inspection notes' },
      { key: 'other', label: 'Other document' },
    ],
  },
};