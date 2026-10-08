/**
 * Wet verbetering poortwachter — mijlpalen voor een lopende ziekmelding.
 *
 * Dagen tellen vanaf de eerste ziektedag (dag 0). De wettelijke uiterste
 * termijnen: probleemanalyse in week 6, plan van aanpak in week 8 en de
 * ziekmelding bij het UWV (42e-weeksmelding) in week 42. We herinneren een
 * week vóór de deadline, zodat er nog tijd is om te handelen.
 */
export type PoortwachterField = 'week6ProblemAnalysis' | 'week8ActionPlan' | 'week42UwvNotification';

export interface PoortwachterMilestone {
  week: number;
  field: PoortwachterField;
  /** Laatste dag (vanaf eerste ziektedag) waarop de actie gedaan moet zijn. */
  deadlineDay: number;
  /** Vanaf deze dag sturen we een herinnering. */
  remindFromDay: number;
  label: string;
  action: string;
}

export const POORTWACHTER_MILESTONES: PoortwachterMilestone[] = [
  {
    week: 6,
    field: 'week6ProblemAnalysis',
    deadlineDay: 42,
    remindFromDay: 35,
    label: 'Probleemanalyse',
    action: 'Laat de bedrijfsarts uiterlijk in week 6 de probleemanalyse opstellen.',
  },
  {
    week: 8,
    field: 'week8ActionPlan',
    deadlineDay: 56,
    remindFromDay: 49,
    label: 'Plan van aanpak',
    action: 'Stel uiterlijk in week 8 samen met de medewerker het plan van aanpak op (verplicht voor UWV).',
  },
  {
    week: 42,
    field: 'week42UwvNotification',
    deadlineDay: 294,
    remindFromDay: 280,
    label: 'UWV-ziekmelding (42 weken)',
    action: 'Dien uiterlijk in week 42 de ziekmelding in bij het UWV. Dit is wettelijk verplicht.',
  },
];

export interface SickTrackerLike {
  sicknessStartDate: string;
  sicknessEndDate?: string | null;
  week6ProblemAnalysis: boolean;
  week8ActionPlan: boolean;
  week42UwvNotification: boolean;
}

/** Mijlpalen die nu aandacht vragen (herinneringsperiode bereikt en nog niet afgevinkt). */
export function dueMilestones(tracker: SickTrackerLike, daysIll: number): PoortwachterMilestone[] {
  return POORTWACHTER_MILESTONES.filter((m) => daysIll >= m.remindFromDay && !tracker[m.field]);
}
