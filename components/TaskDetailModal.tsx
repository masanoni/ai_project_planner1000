import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ProjectTask, EditableExtendedTaskDetails, SubStep, ActionItem, NumericalTarget, NumericalTargetStatus, SubStepStatus, SlideDeck, Attachment, Decision } from '../types';
import { XIcon, SubtaskIcon, NotesIcon, ResourcesIcon, ResponsibleIcon, PlusCircleIcon, TrashIcon, CheckSquareIcon, SquareIcon, PaperClipIcon, SparklesIcon, PresentationChartBarIcon, ClipboardDocumentListIcon, LightBulbIcon, CalendarIcon, GaugeIcon, RefreshIcon } from './icons';
import { generateStepProposals, generateInitialSlideDeck } from '../services/geminiService';
import ProposalReviewModal from './ProposalReviewModal';
import SlideEditorView from './SlideEditorView';
import ActionItemReportModal from './ActionItemReportModal';
import ActionItemTableModal from './ActionItemTableModal';
import CustomTaskReportModal from './CustomTaskReportModal';
import DecisionModal from './DecisionModal';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface TaskDetailModalProps {
  task: ProjectTask;
  onClose: () => void;
  onUpdateTask: (taskId: string, updates: EditableExtendedTaskDetails) => void;
  generateUniqueId: (prefix: string) => string;
  projectGoal: string;
  targetDate: string;
  canEdit?: boolean;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ 
  task, 
  onClose, 
  onUpdateTask, 
  generateUniqueId, 
  projectGoal, 
  targetDate,
  canEdit = true 
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'substeps' | 'details'>('info');
  const [extendedDetails, setExtendedDetails] = useState<EditableExtendedTaskDetails>(() => ({
    subSteps: task.extendedDetails?.subSteps || [],
    resources: task.extendedDetails?.resources || '',
    responsible: task.extendedDetails?.responsible || '',
    notes: task.extendedDetails?.notes || '',
    numericalTarget: task.extendedDetails?.numericalTarget,
    dueDate: task.extendedDetails?.dueDate || '',
    reportDeck: task.extendedDetails?.reportDeck,
    resourceMatrix: task.extendedDetails?.resourceMatrix || null,
    attachments: task.extendedDetails?.attachments || [],
    decisions: task.extendedDetails?.decisions || [],
    subStepCanvasSize: task.extendedDetails?.subStepCanvasSize || { width: 1200, height: 800 },
  }));

  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [isReportEditorOpen, setIsReportEditorOpen] = useState(false);
  const [isCustomReportModalOpen, setIsCustomReportModalOpen] = useState(false);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [isGeneratingProposals, setIsGeneratingProposals] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<{ title: string; description: string; }[]>([]);
  const [selectedActionItem, setSelectedActionItem] = useState<{ actionItem: ActionItem; subStepId: string } | null>(null);
  const [actionItemTableData, setActionItemTableData] = useState<{ items: { actionItem: ActionItem; subStep: SubStep }[]; taskName: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const subStepCanvasRef = useRef<HTMLDivElement>(null);

  // Connection state for sub-steps
  const [connectingState, setConnectingState] = useState<{ fromId: string; fromPos: { x: number; y: number } } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Auto-save when extendedDetails changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onUpdateTask(task.id, extendedDetails);
    }, 500); // 500ms delay for auto-save

    return () => clearTimeout(timeoutId);
  }, [extendedDetails, task.id, onUpdateTask]);

  const updateExtendedDetails = useCallback((updates: Partial<EditableExtendedTaskDetails>) => {
    setExtendedDetails(prev => ({ ...prev, ...updates }));
  }, []);

  const handleGenerateProposals = async () => {
    setIsGeneratingProposals(true);
    setProposalError(null);
    try {
      const generatedProposals = await generateStepProposals(task);
      setProposals(generatedProposals);
      setIsProposalModalOpen(true);
    } catch (err) {
      setProposalError(err instanceof Error ? err.message : 'ステップ提案の生成に失敗しました。');
    } finally {
      setIsGeneratingProposals(false);
    }
  };

  const handleProposalConfirm = (additions: { newSubSteps: { title: string; description: string; }[], newActionItems: { targetSubStepId: string, title: string }[] }) => {
    const newSubSteps: SubStep[] = additions.newSubSteps.map((proposal, index) => ({
      id: generateUniqueId('substep'),
      text: proposal.title,
      notes: proposal.description,
      position: { 
        x: 50 + (extendedDetails.subSteps.length + index) * 250, 
        y: 50 + Math.floor((extendedDetails.subSteps.length + index) / 4) * 200 
      },
      actionItems: [],
    }));

    const updatedSubSteps = [...extendedDetails.subSteps, ...newSubSteps].map(subStep => {
      const newActionItemsForThisSubStep = additions.newActionItems.filter(item => item.targetSubStepId === subStep.id);
      if (newActionItemsForThisSubStep.length > 0) {
        const newActionItems: ActionItem[] = newActionItemsForThisSubStep.map(item => ({
          id: generateUniqueId('action'),
          text: item.title,
          completed: false,
        }));
        return { ...subStep, actionItems: [...(subStep.actionItems || []), ...newActionItems] };
      }
      return subStep;
    });

    updateExtendedDetails({ subSteps: updatedSubSteps });
    setIsProposalModalOpen(false);
  };

  const handleGenerateReport = async () => {
    if (extendedDetails.reportDeck) {
      setIsReportEditorOpen(true);
      return;
    }
    setIsGeneratingReport(true);
    setReportError(null);
    try {
      const deck = await generateInitialSlideDeck(task, projectGoal);
      updateExtendedDetails({ reportDeck: deck });
      setIsReportEditorOpen(true);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'レポートの生成に失敗しました。');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleReportSave = (deck: SlideDeck) => {
    updateExtendedDetails({ reportDeck: deck });
  };

  const handleCustomReportGenerated = (deck: SlideDeck) => {
    updateExtendedDetails({ reportDeck: deck });
    setIsCustomReportModalOpen(false);
    setIsReportEditorOpen(true);
  };

  const handleAddSubStep = () => {
    if (!canEdit) return;
    const newSubStep: SubStep = {
      id: generateUniqueId('substep'),
      text: '新しいサブステップ',
      position: { 
        x: 50 + extendedDetails.subSteps.length * 250, 
        y: 50 + Math.floor(extendedDetails.subSteps.length / 4) * 200 
      },
      actionItems: [],
    };
    updateExtendedDetails({ subSteps: [...extendedDetails.subSteps, newSubStep] });
  };

  const handleRemoveSubStep = (subStepId: string) => {
    if (!canEdit) return;
    if (confirm('このサブステップを削除しますか？')) {
      updateExtendedDetails({ 
        subSteps: extendedDetails.subSteps.filter(ss => ss.id !== subStepId) 
      });
    }
  };

  const handleUpdateSubStep = (subStepId: string, updates: Partial<SubStep>) => {
    if (!canEdit) return;
    updateExtendedDetails({
      subSteps: extendedDetails.subSteps.map(ss => 
        ss.id === subStepId ? { ...ss, ...updates } : ss
      )
    });
  };

  const handleSubStepPositionUpdate = (subStepId: string, position: { x: number; y: number }) => {
    if (!canEdit) return;
    handleUpdateSubStep(subStepId, { position });
  };

  const handleAddActionItem = (subStepId: string) => {
    if (!canEdit) return;
    const newActionItem: ActionItem = {
      id: generateUniqueId('action'),
      text: '新しいアクションアイテム',
      completed: false,
    };
    
    updateExtendedDetails({
      subSteps: extendedDetails.subSteps.map(ss => 
        ss.id === subStepId 
          ? { ...ss, actionItems: [...(ss.actionItems || []), newActionItem] }
          : ss
      )
    });
  };

  const handleUpdateActionItem = (subStepId: string, actionItemId: string, updates: Partial<ActionItem>) => {
    if (!canEdit) return;
    updateExtendedDetails({
      subSteps: extendedDetails.subSteps.map(ss => 
        ss.id === subStepId 
          ? { 
              ...ss, 
              actionItems: (ss.actionItems || []).map(ai => 
                ai.id === actionItemId ? { ...ai, ...updates } : ai
              )
            }
          : ss
      )
    });
  };

  const handleRemoveActionItem = (subStepId: string, actionItemId: string) => {
    if (!canEdit) return;
    if (confirm('このアクションアイテムを削除しますか？')) {
      updateExtendedDetails({
        subSteps: extendedDetails.subSteps.map(ss => 
          ss.id === subStepId 
            ? { ...ss, actionItems: (ss.actionItems || []).filter(ai => ai.id !== actionItemId) }
            : ss
        )
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE_MB = 5;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
    
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`ファイルサイズが大きすぎます。${MAX_FILE_SIZE_MB}MB未満のファイルを選択してください。`);
      if (event.target) event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        const newAttachment: Attachment = {
          id: generateUniqueId('attach'),
          name: file.name,
          type: file.type,
          dataUrl: e.target.result,
        };
        updateExtendedDetails({ 
          attachments: [...extendedDetails.attachments, newAttachment] 
        });
      } else {
        alert('ファイルの読み込みに失敗しました。');
      }
    };
    reader.onerror = () => {
      alert('ファイルの読み込み中にエラーが発生しました。');
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    if (!canEdit) return;
    updateExtendedDetails({
      attachments: extendedDetails.attachments.filter(a => a.id !== attachmentId)
    });
  };

  const handleStartConnection = (subStepId: string, event: React.MouseEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    if (!subStepCanvasRef.current) return;
    const containerRect = subStepCanvasRef.current.getBoundingClientRect();
    const fromPos = {
      x: event.clientX - containerRect.left + subStepCanvasRef.current.scrollLeft,
      y: event.clientY - containerRect.top + subStepCanvasRef.current.scrollTop,
    };
    setConnectingState({ fromId: subStepId, fromPos });
  };

  const handleEndConnection = (targetSubStepId: string) => {
    if (!canEdit) return;
    if (!connectingState || connectingState.fromId === targetSubStepId) {
      setConnectingState(null);
      return;
    }
    
    const sourceSubStep = extendedDetails.subSteps.find(ss => ss.id === connectingState.fromId);
    if (sourceSubStep) {
      const newNextSubStepIds = Array.from(new Set([...(sourceSubStep.nextSubStepIds || []), targetSubStepId]));
      handleUpdateSubStep(sourceSubStep.id, { nextSubStepIds: newNextSubStepIds });
    }
    setConnectingState(null);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!connectingState || !subStepCanvasRef.current) return;
    const containerRect = subStepCanvasRef.current.getBoundingClientRect();
    setMousePos({
      x: event.clientX - containerRect.left + subStepCanvasRef.current.scrollLeft,
      y: event.clientY - containerRect.top + subStepCanvasRef.current.scrollTop,
    });
  };

  const handleMouseUp = () => {
    if (connectingState) {
      setConnectingState(null);
    }
  };

  const handleDeleteConnection = (sourceSubStepId: string, targetSubStepId: string) => {
    if (!canEdit) return;
    const sourceSubStep = extendedDetails.subSteps.find(ss => ss.id === sourceSubStepId);
    if (sourceSubStep) {
      const newNextSubStepIds = (sourceSubStep.nextSubStepIds || []).filter(id => id !== targetSubStepId);
      handleUpdateSubStep(sourceSubStep.id, { nextSubStepIds: newNextSubStepIds });
    }
  };

  const handleActionItemReport = (subStepId: string, actionItem: ActionItem) => {
    setSelectedActionItem({ actionItem, subStepId });
  };

  const handleActionItemReportSave = (updatedActionItem: ActionItem) => {
    if (selectedActionItem) {
      handleUpdateActionItem(selectedActionItem.subStepId, updatedActionItem.id, updatedActionItem);
      setSelectedActionItem(null);
    }
  };

  const handleShowActionItemTable = (subStepId?: string) => {
    if (subStepId) {
      const subStep = extendedDetails.subSteps.find(ss => ss.id === subStepId);
      if (subStep && subStep.actionItems) {
        const items = subStep.actionItems.map(ai => ({ actionItem: ai, subStep }));
        setActionItemTableData({ items, taskName: task.title });
      }
    } else {
      const allItems: { actionItem: ActionItem; subStep: SubStep }[] = [];
      extendedDetails.subSteps.forEach(subStep => {
        (subStep.actionItems || []).forEach(actionItem => {
          allItems.push({ actionItem, subStep });
        });
      });
      setActionItemTableData({ items: allItems, taskName: task.title });
    }
  };

  const handleDecisionsSave = (decisions: Decision[]) => {
    updateExtendedDetails({ decisions });
    setIsDecisionModalOpen(false);
  };

  const handleAutoLayout = () => {
    if (!canEdit) return;
    const updatedSubSteps = extendedDetails.subSteps.map((subStep, index) => ({
      ...subStep,
      position: {
        x: 50 + (index % 3) * 300,
        y: 50 + Math.floor(index / 3) * 250,
      },
    }));
    updateExtendedDetails({ subSteps: updatedSubSteps });
  };

  const connectors = useMemo(() => {
    const newConnectors: Array<{
      id: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
      sourceId: string;
      targetId: string;
    }> = [];

    extendedDetails.subSteps.forEach(sourceSubStep => {
      if (sourceSubStep.nextSubStepIds && sourceSubStep.position) {
        const sourcePos = {
          x: sourceSubStep.position.x + 200,
          y: sourceSubStep.position.y + 75,
        };

        sourceSubStep.nextSubStepIds.forEach(targetId => {
          const targetSubStep = extendedDetails.subSteps.find(ss => ss.id === targetId);
          if (targetSubStep && targetSubStep.position) {
            const targetPos = {
              x: targetSubStep.position.x,
              y: targetSubStep.position.y + 75,
            };
            newConnectors.push({
              id: `conn-${sourceSubStep.id}-${targetId}`,
              from: sourcePos,
              to: targetPos,
              sourceId: sourceSubStep.id,
              targetId: targetId,
            });
          }
        });
      }
    });

    return newConnectors;
  }, [extendedDetails.subSteps]);

  const getStatusColor = (status?: SubStepStatus) => {
    switch(status) {
      case SubStepStatus.COMPLETED: return 'border-green-500';
      case SubStepStatus.IN_PROGRESS: return 'border-blue-500';
      default: return 'border-slate-300';
    }
  };

  const getStatusBadge = (status?: SubStepStatus) => {
    switch(status) {
      case SubStepStatus.COMPLETED: 
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">完了</span>;
      case SubStepStatus.IN_PROGRESS: 
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">進行中</span>;
      default: 
        return <span className="px-2 py-1 text-xs bg-slate-100 text-slate-800 rounded-full">未着手</span>;
    }
  };

  const completedActionItems = extendedDetails.subSteps.reduce((total, ss) => 
    total + (ss.actionItems?.filter(ai => ai.completed).length || 0), 0
  );
  const totalActionItems = extendedDetails.subSteps.reduce((total, ss) => 
    total + (ss.actionItems?.length || 0), 0
  );

  if (isReportEditorOpen && extendedDetails.reportDeck) {
    return (
      <SlideEditorView
        tasks={[task]}
        initialDeck={extendedDetails.reportDeck}
        onSave={handleReportSave}
        onClose={() => setIsReportEditorOpen(false)}
        generateUniqueId={generateUniqueId}
        projectGoal={projectGoal}
        targetDate={targetDate}
        reportScope="task"
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-[50]">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
          <header className="flex items-center justify-between p-6 border-b border-slate-200 flex-shrink-0">
            <div className="flex-grow min-w-0 mr-4">
              <h3 className="text-2xl font-bold text-slate-800 break-words">{task.title}</h3>
              <p className="text-slate-600 mt-1 break-words">{task.description}</p>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={() => setIsDecisionModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700"
                title="決定事項を管理"
              >
                <LightBulbIcon className="w-4 h-4" />
                決定事項 ({extendedDetails.decisions.length})
              </button>
              <button
                onClick={() => handleShowActionItemTable()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300"
                title="全アクションアイテムを表示"
              >
                <ClipboardDocumentListIcon className="w-4 h-4" />
                アクション一覧 ({completedActionItems}/{totalActionItems})
              </button>
              <button
                onClick={() => setIsCustomReportModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"
                title="カスタムレポートを作成"
              >
                <SparklesIcon className="w-4 h-4" />
                カスタムレポート
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:bg-slate-400"
                title="タスクレポートを生成"
              >
                {isGeneratingReport ? <LoadingSpinner size="sm" color="border-white" /> : <PresentationChartBarIcon className="w-4 h-4" />}
                タスクレポート
              </button>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-slate-700 transition-colors p-2 rounded-full hover:bg-slate-100"
                title="閉じる"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
          </header>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'info' 
                  ? 'border-blue-500 text-blue-600 bg-white' 
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              タスク情報
            </button>
            <button
              onClick={() => setActiveTab('substeps')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'substeps' 
                  ? 'border-blue-500 text-blue-600 bg-white' 
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              サブステップ計画 ({extendedDetails.subSteps.length})
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'details' 
                  ? 'border-blue-500 text-blue-600 bg-white' 
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              サブステップの詳細
            </button>
          </div>

          <div className="flex-grow overflow-hidden">
            {/* タスク情報タブ */}
            {activeTab === 'info' && (
              <div className="p-6 overflow-y-auto h-full">
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                        <ResponsibleIcon className="w-4 h-4 mr-2" />
                        担当者
                      </label>
                      <input
                        type="text"
                        value={extendedDetails.responsible}
                        onChange={(e) => updateExtendedDetails({ responsible: e.target.value })}
                        disabled={!canEdit}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="担当者名"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        期日
                      </label>
                      <input
                        type="date"
                        value={extendedDetails.dueDate}
                        onChange={(e) => updateExtendedDetails({ dueDate: e.target.value })}
                        disabled={!canEdit}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                      <ResourcesIcon className="w-4 h-4 mr-2" />
                      必要なリソース
                    </label>
                    <textarea
                      value={extendedDetails.resources}
                      onChange={(e) => updateExtendedDetails({ resources: e.target.value })}
                      disabled={!canEdit}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="必要な人員、設備、予算など"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                      <NotesIcon className="w-4 h-4 mr-2" />
                      メモ・備考
                    </label>
                    <textarea
                      value={extendedDetails.notes}
                      onChange={(e) => updateExtendedDetails({ notes: e.target.value })}
                      disabled={!canEdit}
                      rows={6}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="追加の情報や注意事項"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                      <GaugeIcon className="w-4 h-4 mr-2" />
                      数値目標
                    </label>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={extendedDetails.numericalTarget?.description || ''}
                        onChange={(e) => updateExtendedDetails({ 
                          numericalTarget: { 
                            ...extendedDetails.numericalTarget, 
                            description: e.target.value,
                            targetValue: extendedDetails.numericalTarget?.targetValue || '',
                            unit: extendedDetails.numericalTarget?.unit || '',
                          } as NumericalTarget
                        })}
                        disabled={!canEdit}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="目標の説明"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={extendedDetails.numericalTarget?.targetValue || ''}
                          onChange={(e) => updateExtendedDetails({ 
                            numericalTarget: { 
                              ...extendedDetails.numericalTarget, 
                              targetValue: e.target.value,
                              description: extendedDetails.numericalTarget?.description || '',
                              unit: extendedDetails.numericalTarget?.unit || '',
                            } as NumericalTarget
                          })}
                          disabled={!canEdit}
                          className="px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="目標値"
                        />
                        <input
                          type="text"
                          value={extendedDetails.numericalTarget?.unit || ''}
                          onChange={(e) => updateExtendedDetails({ 
                            numericalTarget: { 
                              ...extendedDetails.numericalTarget, 
                              unit: e.target.value,
                              description: extendedDetails.numericalTarget?.description || '',
                              targetValue: extendedDetails.numericalTarget?.targetValue || '',
                            } as NumericalTarget
                          })}
                          disabled={!canEdit}
                          className="px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="単位"
                        />
                      </div>
                      {extendedDetails.numericalTarget && (
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={extendedDetails.numericalTarget.currentValue || ''}
                            onChange={(e) => updateExtendedDetails({ 
                              numericalTarget: { 
                                ...extendedDetails.numericalTarget, 
                                currentValue: e.target.value 
                              } 
                            })}
                            disabled={!canEdit}
                            className="px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="現在値"
                          />
                          <select
                            value={extendedDetails.numericalTarget.status || NumericalTargetStatus.PENDING}
                            onChange={(e) => updateExtendedDetails({ 
                              numericalTarget: { 
                                ...extendedDetails.numericalTarget, 
                                status: e.target.value as NumericalTargetStatus 
                              } 
                            })}
                            disabled={!canEdit}
                            className="px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value={NumericalTargetStatus.PENDING}>進行中</option>
                            <option value={NumericalTargetStatus.ACHIEVED}>達成</option>
                            <option value={NumericalTargetStatus.MISSED}>未達成</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-slate-700 flex items-center">
                        <PaperClipIcon className="w-4 h-4 mr-2" />
                        添付ファイル ({extendedDetails.attachments.length})
                      </label>
                      {canEdit && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          ファイル追加
                        </button>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      multiple={false}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {extendedDetails.attachments.map(attachment => (
                        <div key={attachment.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-md">
                          <a
                            href={attachment.dataUrl}
                            download={attachment.name}
                            className="text-sm text-blue-600 hover:underline truncate flex-1"
                            title={attachment.name}
                          >
                            {attachment.name}
                          </a>
                          {canEdit && (
                            <button
                              onClick={() => handleRemoveAttachment(attachment.id)}
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* サブステップ計画タブ */}
            {activeTab === 'substeps' && (
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                      <SubtaskIcon className="w-5 h-5 mr-2" />
                      サブステップフロー ({extendedDetails.subSteps.length})
                    </h4>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate-600">
                        進捗: {completedActionItems}/{totalActionItems} アクション完了
                      </span>
                      {canEdit && (
                        <>
                          <button
                            onClick={handleAutoLayout}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300"
                            title="自動整列"
                          >
                            <RefreshIcon className="w-4 h-4" />
                            整列
                          </button>
                          <button
                            onClick={handleGenerateProposals}
                            disabled={isGeneratingProposals}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-400"
                          >
                            {isGeneratingProposals ? <LoadingSpinner size="sm" color="border-white" /> : <SparklesIcon className="w-4 h-4" />}
                            AIで提案
                          </button>
                          <button
                            onClick={handleAddSubStep}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"
                          >
                            <PlusCircleIcon className="w-4 h-4" />
                            追加
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {proposalError && <ErrorMessage message={proposalError} />}
                  {reportError && <ErrorMessage message={reportError} />}
                </div>

                <div 
                  ref={subStepCanvasRef}
                  className="flex-1 overflow-auto bg-slate-100 relative p-4"
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  style={{ minHeight: '600px' }}
                >
                  {extendedDetails.subSteps.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <SubtaskIcon className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                        <p className="text-slate-500 text-lg mb-4">サブステップがありません</p>
                        <p className="text-slate-400 text-sm">
                          {canEdit ? 'AIでステップ提案を生成するか、手動でサブステップを追加してください。' : 'サブステップが設定されていません。'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {extendedDetails.subSteps.map((subStep) => (
                        <div
                          key={subStep.id}
                          className={`absolute bg-white rounded-lg shadow-md border-l-4 ${getStatusColor(subStep.status)} p-3 w-64`}
                          style={{
                            left: subStep.position?.x || 0,
                            top: subStep.position?.y || 0,
                          }}
                          onMouseUp={() => handleEndConnection(subStep.id)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={subStep.text}
                                onChange={(e) => handleUpdateSubStep(subStep.id, { text: e.target.value })}
                                disabled={!canEdit}
                                className="w-full font-semibold text-slate-800 bg-transparent border-none outline-none text-sm"
                              />
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(subStep.status)}
                              </div>
                            </div>
                            <div className="flex items-center space-x-1 ml-2">
                              {canEdit && (
                                <div
                                  onMouseDown={(e) => handleStartConnection(subStep.id, e)}
                                  className="w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-crosshair hover:scale-125 transition-transform"
                                  title="ドラッグして接続"
                                />
                              )}
                              {canEdit && (
                                <button
                                  onClick={() => handleRemoveSubStep(subStep.id)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  title="削除"
                                >
                                  <TrashIcon className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="font-medium text-slate-600">担当:</span>
                              <span className="ml-1 text-slate-800">{subStep.responsible || '未設定'}</span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-600">期日:</span>
                              <span className="ml-1 text-slate-800">
                                {subStep.dueDate ? new Date(subStep.dueDate + 'T00:00:00Z').toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : '未設定'}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-600">アクション:</span>
                              <span className="ml-1 text-slate-800">
                                {(subStep.actionItems || []).filter(ai => ai.completed).length}/{(subStep.actionItems || []).length}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}

                      <svg 
                        style={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          width: '100%', 
                          height: '100%', 
                          pointerEvents: 'none',
                          overflow: 'visible'
                        }}
                      >
                        <defs>
                          <marker
                            id="arrowhead-substep"
                            markerWidth="8"
                            markerHeight="6"
                            refX="8"
                            refY="3"
                            orient="auto"
                            markerUnits="strokeWidth"
                          >
                            <path d="M0,0 L8,3 L0,6 Z" fill="#64748b" />
                          </marker>
                        </defs>
                        
                        {connectors.map(conn => (
                          <g key={conn.id}>
                            <path
                              d={`M${conn.from.x},${conn.from.y} C${conn.from.x + 50},${conn.from.y} ${conn.to.x - 50},${conn.to.y} ${conn.to.x},${conn.to.y}`}
                              stroke="#64748b"
                              strokeWidth="2"
                              markerEnd="url(#arrowhead-substep)"
                              fill="none"
                            />
                            {canEdit && (
                              <circle
                                cx={(conn.from.x + conn.to.x) / 2}
                                cy={(conn.from.y + conn.to.y) / 2}
                                r="8"
                                fill="white"
                                stroke="#ef4444"
                                strokeWidth="2"
                                className="cursor-pointer hover:fill-red-100"
                                onClick={() => handleDeleteConnection(conn.sourceId, conn.targetId)}
                                style={{ pointerEvents: 'auto' }}
                              />
                            )}
                          </g>
                        ))}
                        
                        {connectingState && (
                          <path
                            d={`M${connectingState.fromPos.x},${connectingState.fromPos.y} L${mousePos.x},${mousePos.y}`}
                            stroke="#3b82f6"
                            strokeWidth="2"
                            strokeDasharray="5,5"
                            fill="none"
                          />
                        )}
                      </svg>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* サブステップの詳細タブ */}
            {activeTab === 'details' && (
              <div className="p-6 overflow-y-auto h-full">
                <div className="space-y-6">
                  {extendedDetails.subSteps.length === 0 ? (
                    <div className="text-center py-12">
                      <SubtaskIcon className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                      <p className="text-slate-500 text-lg">サブステップがありません</p>
                      <p className="text-slate-400 text-sm mt-2">
                        まず「サブステップ計画」タブでサブステップを作成してください。
                      </p>
                    </div>
                  ) : (
                    extendedDetails.subSteps.map((subStep) => (
                      <div key={subStep.id} className="bg-white border border-slate-200 rounded-lg p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={subStep.text}
                              onChange={(e) => handleUpdateSubStep(subStep.id, { text: e.target.value })}
                              disabled={!canEdit}
                              className="text-lg font-semibold text-slate-800 bg-transparent border-none outline-none w-full"
                            />
                            <div className="flex items-center gap-3 mt-2">
                              {getStatusBadge(subStep.status)}
                              {canEdit && (
                                <select
                                  value={subStep.status || SubStepStatus.NOT_STARTED}
                                  onChange={(e) => handleUpdateSubStep(subStep.id, { status: e.target.value as SubStepStatus })}
                                  className="text-sm border border-slate-300 rounded px-2 py-1"
                                >
                                  <option value={SubStepStatus.NOT_STARTED}>未着手</option>
                                  <option value={SubStepStatus.IN_PROGRESS}>進行中</option>
                                  <option value={SubStepStatus.COMPLETED}>完了</option>
                                </select>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleShowActionItemTable(subStep.id)}
                              className="text-sm text-blue-600 hover:text-blue-800"
                              title="アクションアイテム一覧"
                            >
                              一覧表示
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => handleAddActionItem(subStep.id)}
                                className="text-sm text-green-600 hover:text-green-800"
                                title="アクションアイテム追加"
                              >
                                アクション追加
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="text-sm font-medium text-slate-600">担当者</label>
                            <input
                              type="text"
                              value={subStep.responsible || ''}
                              onChange={(e) => handleUpdateSubStep(subStep.id, { responsible: e.target.value })}
                              disabled={!canEdit}
                              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md"
                              placeholder="担当者名"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-600">期日</label>
                            <input
                              type="date"
                              value={subStep.dueDate || ''}
                              onChange={(e) => handleUpdateSubStep(subStep.id, { dueDate: e.target.value })}
                              disabled={!canEdit}
                              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md"
                            />
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className="text-sm font-medium text-slate-600">メモ・詳細</label>
                          <textarea
                            value={subStep.notes || ''}
                            onChange={(e) => handleUpdateSubStep(subStep.id, { notes: e.target.value })}
                            disabled={!canEdit}
                            rows={3}
                            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md"
                            placeholder="詳細な説明や注意事項"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="text-sm font-medium text-slate-700">
                              アクションアイテム ({(subStep.actionItems || []).filter(ai => ai.completed).length}/{(subStep.actionItems || []).length})
                            </h5>
                          </div>
                          <div className="space-y-3">
                            {(subStep.actionItems || []).map((actionItem) => (
                              <div key={actionItem.id} className="flex items-start space-x-3 p-3 bg-slate-50 rounded-md">
                                <button
                                  onClick={() => handleUpdateActionItem(subStep.id, actionItem.id, { completed: !actionItem.completed })}
                                  disabled={!canEdit}
                                  className="mt-1 flex-shrink-0"
                                >
                                  {actionItem.completed ? (
                                    <CheckSquareIcon className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <SquareIcon className="w-5 h-5 text-slate-400" />
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <input
                                    type="text"
                                    value={actionItem.text}
                                    onChange={(e) => handleUpdateActionItem(subStep.id, actionItem.id, { text: e.target.value })}
                                    disabled={!canEdit}
                                    className={`w-full bg-transparent border-none outline-none font-medium ${actionItem.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}
                                  />
                                  <div className="grid grid-cols-2 gap-3 mt-2">
                                    <input
                                      type="text"
                                      value={actionItem.responsible || ''}
                                      onChange={(e) => handleUpdateActionItem(subStep.id, actionItem.id, { responsible: e.target.value })}
                                      disabled={!canEdit}
                                      className="text-sm border border-slate-300 rounded px-2 py-1"
                                      placeholder="担当者"
                                    />
                                    <input
                                      type="date"
                                      value={actionItem.dueDate || ''}
                                      onChange={(e) => handleUpdateActionItem(subStep.id, actionItem.id, { dueDate: e.target.value })}
                                      disabled={!canEdit}
                                      className="text-sm border border-slate-300 rounded px-2 py-1"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleActionItemReport(subStep.id, actionItem)}
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                    title="実施レポート"
                                  >
                                    📊
                                  </button>
                                  {canEdit && (
                                    <button
                                      onClick={() => handleRemoveActionItem(subStep.id, actionItem.id)}
                                      className="text-red-500 hover:text-red-700"
                                      title="削除"
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isProposalModalOpen && (
        <ProposalReviewModal
          proposals={proposals}
          existingSubSteps={extendedDetails.subSteps}
          onConfirm={handleProposalConfirm}
          onClose={() => setIsProposalModalOpen(false)}
        />
      )}

      {selectedActionItem && (
        <ActionItemReportModal
          actionItem={selectedActionItem.actionItem}
          onSave={handleActionItemReportSave}
          onClose={() => setSelectedActionItem(null)}
          generateUniqueId={generateUniqueId}
        />
      )}

      {actionItemTableData && (
        <ActionItemTableModal
          items={actionItemTableData.items}
          taskName={actionItemTableData.taskName}
          onClose={() => setActionItemTableData(null)}
        />
      )}

      {isCustomReportModalOpen && (
        <CustomTaskReportModal
          task={task}
          isOpen={isCustomReportModalOpen}
          onClose={() => setIsCustomReportModalOpen(false)}
          onReportGenerated={handleCustomReportGenerated}
        />
      )}

      {isDecisionModalOpen && (
        <DecisionModal
          isOpen={isDecisionModalOpen}
          onClose={() => setIsDecisionModalOpen(false)}
          onSave={handleDecisionsSave}
          task={task}
          generateUniqueId={generateUniqueId}
        />
      )}
    </>
  );
};

export default TaskDetailModal;