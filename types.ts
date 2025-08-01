export interface Attachment {
  id: string;
  name: string;
  type: string;
  dataUrl: string; // Base64 encoded URL for image preview
}

export enum SubStepStatus {
  NOT_STARTED = 'Not Started',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
}

export interface ActionItemReport {
  notes: string;
  attachments: Attachment[];
  matrixData: { headers: string[]; rows: string[][] } | null;
}

export interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  completedDate?: string;
  responsible?: string;
  report?: ActionItemReport;
}

export interface SubStep {
  id: string;
  text: string;
  notes?: string;
  nextSubStepIds?: string[];
  position?: { x: number; y: number };
  responsible?: string;
  dueDate?: string;
  status?: SubStepStatus;
  actionItems?: ActionItem[];
  attachments?: Attachment[];
}

export enum NumericalTargetStatus {
  PENDING = 'pending',
  ACHIEVED = 'achieved',
  MISSED = 'missed',
}

export interface NumericalTarget {
  description: string;
  targetValue: number | string;
  unit: string;
  currentValue?: number | string;
  testNotes?: string;
  status?: NumericalTargetStatus;
}

export enum TaskStatus {
  NOT_STARTED = 'Not Started',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  BLOCKED = 'Blocked',
}

// --- NEW SLIDE DECK REPORTING MODEL ---

export type SlideElementType = 'textbox' | 'image' | 'table' | 'chart' | 'flowchart';
export type SlideLayoutType = 'title_slide' | 'title_and_content' | 'section_header' | 'two_column' | 'blank';
export type ChartType = 'bar' | 'pie' | 'line';

export interface SlideElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BaseSlideElement {
  id: string;
  type: SlideElementType;
  position: SlideElementPosition;
}

export interface TextboxElement extends BaseSlideElement {
  type: 'textbox';
  content: string;
  fontSize?: 'small' | 'medium' | 'large' | 'title';
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
}

export interface ImageElement extends BaseSlideElement {
  type: 'image';
  subStepId: string;
  actionItemId: string;
  attachmentId: string;
}

export interface TableElement extends BaseSlideElement {
  type: 'table';
  subStepId: string;
  actionItemId: string;
}

export interface ChartElement extends BaseSlideElement {
  type: 'chart';
  subStepId: string;
  actionItemId: string;
  chartType: ChartType;
  title: string;
}

export interface FlowchartElement extends BaseSlideElement {
  type: 'flowchart';
  data: {
    subSteps: SubStep[];
  };
}

export type SlideElement = TextboxElement | ImageElement | TableElement | ChartElement | FlowchartElement;

export interface Slide {
  id: string;
  layout: SlideLayoutType;
  elements: SlideElement[];
  notes?: string;
  isLocked?: boolean;
}

export interface SlideDeck {
  slides: Slide[];
  theme?: 'light' | 'dark' | 'business';
}

// --- Main Project Interfaces ---

export interface Decision {
  id: string;
  question: string;
  decision?: string;
  reasoning?: string;
  date?: string;
  status: 'decided' | 'undecided';
}

export interface ExtendedTaskDetails {
  subSteps: SubStep[];
  resources: string;
  responsible: string;
  notes: string;
  numericalTarget?: NumericalTarget;
  dueDate?: string;
  reportDeck?: SlideDeck;
  resourceMatrix?: { headers: string[]; rows: string[][] } | null;
  attachments?: Attachment[];
  decisions?: Decision[];
  subStepCanvasSize?: { width: number; height: number };
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  nextTaskIds?: string[];
  position?: { x: number; y: number };
  extendedDetails?: ExtendedTaskDetails;
  status?: TaskStatus;
}

export interface TaskDetail {
  keyActivities: string[];
  estimatedEffort: string;
  potentialChallenges: string[];
  successMetrics: string[];
}

export enum ViewState {
  INPUT_FORM,
  PROJECT_FLOW,
  TASK_DETAIL,
}

export interface ProjectFileContent {
  projectGoal: string;
  targetDate: string;
  tasks: ProjectTask[];
  ganttData?: GanttItem[] | null;
}

export interface TaskExportData {
  task: ProjectTask;
  details: TaskDetail | null;
}

export type EditableTaskFields = Pick<ProjectTask, 'title' | 'description'>;
export type EditableExtendedTaskDetails = ExtendedTaskDetails;
export type EditableProjectTaskFields = Pick<ProjectTask, 'title' | 'description' | 'status'>;

export enum ReportTheme {
  LIGHT = 'light',
  DARK = 'dark',
  BUSINESS = 'business',
}

export interface ProjectHealthReport {
  overallStatus: 'On Track' | 'At Risk' | 'Off Track' | 'Unknown';
  summary: string;
  positivePoints: string[];
  areasOfConcern: {
    description: string;
    relatedTaskIds: string[];
  }[];
  suggestions: string[];
}

export interface GanttItem {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies: string[];
  type: 'task' | 'substep' | 'actionitem';
  parentId: string | null;
}

// --- ✅ 修正済み ProjectMember 型定義（user.email の展開に対応）---

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  invitedBy?: string;
  invitedAt: string;
  joinedAt?: string;
  status: 'pending' | 'accepted' | 'declined';
  userEmail?: string;
  userName?: string;
　 profiles?: { email: string } | null;
  // ← 追加部分
  user?: {
    email: string;
    // name や他の必要な情報があればここに追加可能
  };
}

export interface ProjectInvitation {
  id: string;
  projectId: string;
  email: string;
  role: 'editor' | 'viewer';
  invitedBy: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  usedAt?: string;
}

export interface ProjectWithMetadata {
  id: string;
  title: string;
  goal: string;
  targetDate: string;
  tasks: ProjectTask[];
  ganttData?: GanttItem[] | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy?: string;
  version: number;
  userRole: 'owner' | 'editor' | 'viewer';
  members?: ProjectMember[];
}
