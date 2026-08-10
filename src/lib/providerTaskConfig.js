// ASSUMPTIONS TO VERIFY against your actual marketplace.provider_type enum:
// this assumes the literal values are 'lawyer', 'valuer', 'surveyor'.
// If your enum uses different labels, only this file needs to change.
//
// mode: 'hire'     -> pick a provider, done (transaction_provider_engagements)
// mode: 'schedule' -> pick a provider, then pick a real open time slot
//                     (marketplace.provider_bookings)

export const PROVIDER_TASK_CONFIG = {
  hire_lawyer: {
    providerType: 'lawyer',
    mode: 'hire',
    roleLabel: 'lawyer',
    directoryTitle: 'Choose a lawyer',
  },
  schedule_valuer: {
    providerType: 'valuer',
    mode: 'schedule',
    roleLabel: 'valuer',
    directoryTitle: 'Choose a valuer',
  },
  schedule_surveyor: {
    providerType: 'surveyor',
    mode: 'schedule',
    roleLabel: 'surveyor',
    directoryTitle: 'Choose a surveyor',
  },
};

// Sets of task_keys that render as one combined module (via GROUP_RENDERERS
// in StageTaskModule) instead of one row each. Rendering order within a
// group still comes from stage_task_templates.sort_order, not from the
// order listed here.
//
// Add an entry here whenever several tasks in a stage should be walked
// through one-at-a-time in a single stepper UI instead of showing as
// separate simultaneous checklist rows.
export const TASK_GROUPS = {
  engage_professionals: ['hire_lawyer', 'schedule_valuer', 'schedule_surveyor'],
};