import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../layouts/MainLayout';
import {
  Button,
  DisabledBlock,
  EmptyState,
  MaterialShelf,
  ModalShell,
  StatusPill,
  Stepper,
  SyllabusSwitcher,
  WeekAxis,
} from '../components/DashboardShared';
import {
  buildSyllabus,
  buildSyllabusDraft,
  createGraph,
  generateFinalMaterial,
  generateMaterialDraft,
  getTeacherDashboardData,
  listGraphs,
  publishMaterial,
  updateFinalMaterial,
  updateMaterialDraft,
  updateSyllabus,
  updateSyllabusDraft,
  uploadCalendar,
} from '../api/syllabus_material_api';

const BUILD_STEPS = ['上传', '生成草稿', '修正草稿', '生成终稿', '修正终稿', '完成'];
const MATERIAL_STEPS = ['选择草稿', '修正草稿', '生成终稿', '修正终稿', '发布'];

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function createEmptySyllabus(nextId) {
  return {
    syllabusId: nextId,
    title: '新的教学大纲',
    permission: 'owner',
    graphId: null,
    graphName: null,
    dayOneTime: null,
    status: {
      isEduCalendarMissing: true,
      isDraftMissing: true,
      isFinalMissing: true,
    },
    draft: { period: [] },
    finalData: { title: '新的教学大纲', day_one: '', period: [] },
    graphFiles: [],
    graphFileCount: 0,
    syllabusFiles: [],
    materialDrafts: [],
    materialShelf: [],
  };
}

function createEmptyDraftPeriod() {
  return Array.from({ length: 16 }, (_, index) => ({
    week_index: String(index + 1),
    content: '',
    importance: 'medium',
    day_one: '',
  }));
}

function isSingleQuestion(question) {
  return String(question?.type ?? '').toLowerCase() === 'single';
}

function ensureSingleOptions(question) {
  const source = question?.options ?? {};

  return {
    A: source.A ?? '',
    B: source.B ?? '',
    C: source.C ?? '',
    D: source.D ?? '',
  };
}

function hydrateFinalQuestion(question) {
  const next = cloneData(question);

  if (isSingleQuestion(next)) {
    next.options = ensureSingleOptions(next);
    next.answer = typeof next.answer === 'string' ? next.answer : '';
  }

  return next;
}

function createBuildState(active, graphOptions = []) {
  return {
    open: true,
    step: active.status.isFinalMissing
      ? (active.status.isDraftMissing ? (active.status.isEduCalendarMissing ? 0 : 1) : 2)
      : 4,
    busy: '',
    draftPeriod: active.draft?.period?.length ? cloneData(active.draft.period) : createEmptyDraftPeriod(),
    draftTitle: active.title,
    draftDayOne: active.finalData?.day_one ?? '',
    finalTitle: active.finalData?.title ?? active.title,
    finalDayOne: active.finalData?.day_one ?? '',
    selectedGraphName: active.graphName ?? graphOptions.find((item) => item.graphId === active.graphId)?.graphName ?? '',
    newGraphName: '',
    selectedGraphId: active.graphId ?? '',
    calendarFiles: [],
  };
}

function createMaterialState(active) {
  const selected = active.materialDrafts[0] ?? null;

  return {
    open: true,
    step: selected ? (selected.status.isFinalMissing ? 1 : 3) : 0,
    busy: '',
    materialId: selected?.materialId ?? null,
    draftTitle: selected?.draft?.material_title ?? selected?.title ?? `${active.title}_draft`,
    involvedWeeks: cloneData(selected?.draft?.involved_weeks ?? [4]),
    distribution: { single: 2, judge: 2, short: 1 },
    draftQuestions: cloneData(selected?.draft?.questions ?? []),
    finalQuestions: cloneData(selected?.finalData?.questions ?? []).map(hydrateFinalQuestion),
    publish: { new_pdf: true, do_publish: false },
  };
}

function getSyllabusProgress(status) {
  if (!status.isFinalMissing) return { label: '教学大纲就绪', tone: 'success' };
  if (!status.isDraftMissing) return { label: '已构建草稿', tone: 'warning' };
  if (!status.isEduCalendarMissing) return { label: '已上传', tone: 'neutral' };
  return { label: '待创建', tone: 'warning' };
}

function getMaterialTag(status) {
  if (!status?.isFinalMissing) {
    return { text: '终稿就绪', tone: 'success' };
  }
  if (!status?.isDraftMissing) {
    return { text: '仅草稿', tone: 'warning' };
  }
  return { text: '待生成', tone: 'neutral' };
}

function getMaterialShelfItems(materialDrafts) {
  return materialDrafts.map((item) => {
    const tag = getMaterialTag(item.status);
    const involvedWeeks = item.finalData?.involved_weeks ?? item.draft?.involved_weeks ?? [];

    return {
      title: item.title,
      source: `material ${item.materialId}`,
      weekLabel: involvedWeeks.length ? `第 ${involvedWeeks.join(', ')} 周` : '',
      tagText: tag.text,
      tagTone: tag.tone,
    };
  });
}

function DraftEditorAxis({ items, onChange }) {
  return (
    <WeekAxis
      items={items}
      renderContent={(item) => (
        <textarea
          className="week-axis-input"
          rows="6"
          value={item.content}
          onChange={(event) => onChange(item.week_index, event.target.value)}
        />
      )}
    />
  );
}

function SingleChoiceOptionsEditor({ question, onChangeOption }) {
  const options = ensureSingleOptions(question);

  return (
    <div className="options-grid">
      {['A', 'B', 'C', 'D'].map((key) => (
        <label key={key} className="field">
          <span>{`option_${key}`}</span>
          <input
            value={options[key]}
            onChange={(event) => onChangeOption(key, event.target.value)}
          />
        </label>
      ))}
    </div>
  );
}

function FileDropzone({
  files,
  onFilesChange,
  multiple = false,
  compact = false,
  title = '选择文件 / dropbox',
}) {
  const [isDragging, setIsDragging] = useState(false);

  const applyFiles = (fileList) => {
    const nextFiles = Array.from(fileList ?? []);
    onFilesChange(multiple ? nextFiles : nextFiles.slice(0, 1));
  };

  return (
    <label
      className={['dropzone', 'file-dropzone', compact ? 'compact-dropzone' : '', isDragging ? 'is-dragging' : ''].filter(Boolean).join(' ')}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        applyFiles(event.dataTransfer?.files);
      }}
    >
      <input
        className="file-dropzone-input"
        type="file"
        multiple={multiple}
        onChange={(event) => applyFiles(event.target.files)}
      />
      <div className="file-dropzone-copy">
        <strong>{title}</strong>
        <small>
          {files.length
            ? files.map((file) => file.name).join(' / ')
            : '支持点击选择或拖拽到这里'}
        </small>
      </div>
    </label>
  );
}

function BuildSyllabusModal({
  syllabus,
  state,
  setState,
  graphOptions,
  onClose,
  onCreateGraph,
  onUpload,
  onGenerateDraft,
  onSaveDraft,
  onGenerateFinal,
  onSaveFinal,
}) {
  const allowStep = (index) => {
    if (index === 0) return true;
    if (index === 1) return !syllabus.status.isEduCalendarMissing;
    if (index === 2 || index === 3) return !syllabus.status.isDraftMissing;
    return !syllabus.status.isFinalMissing;
  };

  return (
    <ModalShell title="构建教学大纲" onClose={onClose}>
      <Stepper
        steps={BUILD_STEPS}
        currentStep={state.step}
        allowStep={allowStep}
        onSelect={(index) => allowStep(index) && setState((current) => ({ ...current, step: index }))}
      />

      {state.step === 0 ? (
        <section className="modal-section">
          <div className="build-step-grid">
            <div className="study-mode graph-picker-panel">
              <div className="subsection-head">
                <strong className="study-mode-title">图谱选择</strong>
                <StatusPill tone={state.selectedGraphId ? 'success' : 'warning'}>
                  {state.selectedGraphId ? '已选图谱' : '待选择'}
                </StatusPill>
              </div>
              <div className="graph-create-row">
                <Button
                  variant="secondary"
                  onClick={onCreateGraph}
                  disabled={Boolean(state.busy) || !state.newGraphName.trim()}
                >
                  {state.busy === 'graph' ? '处理中...' : '创建新图谱'}
                </Button>
                <input
                  className="select-field"
                  value={state.newGraphName}
                  placeholder="输入图谱名称"
                  onChange={(event) => setState((current) => ({ ...current, newGraphName: event.target.value }))}
                />
              </div>
              <label className="field">
                <span>graph_id</span>
                <select
                  className="select-field"
                  value={state.selectedGraphId}
                  onChange={(event) => {
                    const nextId = Number(event.target.value) || '';
                    const nextGraph = graphOptions.find((graph) => graph.graphId === nextId);
                    setState((current) => ({
                      ...current,
                      selectedGraphId: nextId,
                      selectedGraphName: nextGraph?.graphName ?? '',
                    }));
                  }}
                >
                  <option value="">请选择图谱</option>
                  {graphOptions.map((graph) => (
                    <option key={graph.graphId} value={graph.graphId}>
                      {graph.graphName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>graph_name</span>
                <input value={state.selectedGraphName} readOnly placeholder="当前所选图谱名称" />
              </label>
            </div>

            <DisabledBlock disabled={!state.selectedGraphId} message="请先在左侧选择一个图谱">
              <div className="study-mode">
                <div className="subsection-head">
                  <strong className="study-mode-title">上传教学日历</strong>
                  <StatusPill tone={!syllabus.status.isEduCalendarMissing ? 'success' : 'warning'}>
                    {!syllabus.status.isEduCalendarMissing ? '已存在' : '待上传'}
                  </StatusPill>
                </div>
                <FileDropzone
                  files={state.calendarFiles}
                  onFilesChange={(files) => setState((current) => ({ ...current, calendarFiles: files }))}
                  title="选择教学日历 / dropbox"
                />
                <div className="tile-actions">
                  <Button
                    variant="primary"
                    onClick={onUpload}
                    disabled={Boolean(state.busy) || !state.selectedGraphId || !state.calendarFiles.length}
                  >
                    {state.busy === 'upload' ? '处理中...' : '上传'}
                  </Button>
                  <Button variant="ghost" onClick={onClose}>取消</Button>
                </div>
              </div>
            </DisabledBlock>
          </div>
        </section>
      ) : null}

      {state.step === 1 ? (
        <section className="modal-section">
          <div className="study-mode">
            <strong className="study-mode-title">生成草稿</strong>
            <div className="processing-panel">
              <span>status</span>
              <strong>
                {state.busy === 'draft'
                  ? '正在处理，稍后再看'
                  : syllabus.status.isDraftMissing
                    ? '等待生成'
                    : '草稿已就绪'}
              </strong>
            </div>
            <div className="tile-actions">
              <Button variant="primary" onClick={onGenerateDraft} disabled={Boolean(state.busy)}>
                {state.busy === 'draft' ? '处理中...' : '生成大纲草稿'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setState((current) => ({ ...current, step: 2 }))}
                disabled={syllabus.status.isDraftMissing}
              >
                修正草稿
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {state.step === 2 ? (
        <section className="modal-section">
          <div className="modal-form-grid">
            <label className="field">
              <span>new_title</span>
              <input
                value={state.draftTitle}
                onChange={(event) => setState((current) => ({ ...current, draftTitle: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>day_one</span>
              <input
                value={state.draftDayOne}
                onChange={(event) => setState((current) => ({ ...current, draftDayOne: event.target.value }))}
              />
            </label>
          </div>
          <DraftEditorAxis
            items={state.draftPeriod}
            onChange={(weekIndex, value) => {
              const next = cloneData(state.draftPeriod);
              const target = next.find((item) => item.week_index === weekIndex);
              if (target) target.content = value;
              setState((current) => ({ ...current, draftPeriod: next }));
            }}
          />
          <div className="tile-actions">
            <Button variant="primary" onClick={onSaveDraft}>保存</Button>
            <Button
              variant="secondary"
              onClick={() => setState((current) => ({ ...current, step: 1 }))}
            >
              重新生成草稿
            </Button>
          </div>
        </section>
      ) : null}

      {state.step === 3 ? (
        <section className="modal-section">
          <div className="study-mode">
            <strong className="study-mode-title">生成终稿</strong>
            <div className="processing-panel">
              <span>status</span>
              <strong>
                {state.busy === 'final'
                  ? '正在处理，稍后再看'
                  : syllabus.status.isFinalMissing
                    ? '等待生成'
                    : '终稿已就绪'}
              </strong>
            </div>
            <div className="tile-actions">
              <Button variant="primary" onClick={onGenerateFinal} disabled={Boolean(state.busy)}>
                {state.busy === 'final' ? '处理中...' : '生成教学大纲'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setState((current) => ({ ...current, step: 4 }))}
                disabled={syllabus.status.isFinalMissing}
              >
                修正终稿
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {state.step === 4 ? (
        <section className="modal-section">
          <div className="modal-form-grid">
            <label className="field">
              <span>title</span>
              <input
                value={state.finalTitle}
                onChange={(event) => setState((current) => ({ ...current, finalTitle: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>day_one</span>
              <input
                value={state.finalDayOne}
                onChange={(event) => setState((current) => ({ ...current, finalDayOne: event.target.value }))}
              />
            </label>
          </div>
          <WeekAxis items={state.draftPeriod} />
          <div className="tile-actions">
            <Button variant="primary" onClick={onSaveFinal}>保存</Button>
            <Button
              variant="secondary"
              onClick={() => setState((current) => ({ ...current, step: 3 }))}
            >
              重新生成
            </Button>
          </div>
        </section>
      ) : null}

      {state.step === 5 ? (
        <section className="modal-section">
          <div className="completion-panel">
            <strong>教学大纲已完成</strong>
            <div className="tile-actions">
              <Button variant="primary" onClick={onClose}>完成</Button>
            </div>
          </div>
        </section>
      ) : null}
    </ModalShell>
  );
}

function MaterialModal({
  syllabus,
  state,
  setState,
  onClose,
  onGenerateDraft,
  onSaveDraft,
  onGenerateFinal,
  onSaveFinal,
  onPublish,
}) {
  const allowStep = (index) => {
    if (index === 0) return true;
    if (index === 1 || index === 2) return syllabus.materialDrafts.length > 0 || !syllabus.status.isEduCalendarMissing;
    return state.finalQuestions.length > 0 || syllabus.materialDrafts.some((item) => !item.status.isFinalMissing);
  };

  return (
    <ModalShell title="教学习题构建 / 编辑" onClose={onClose}>
      <Stepper
        steps={MATERIAL_STEPS}
        currentStep={state.step}
        allowStep={allowStep}
        onSelect={(index) => allowStep(index) && setState((current) => ({ ...current, step: index }))}
      />

      {state.step === 0 ? (
        <section className="modal-section">
          <div className="study-mode">
            <div className="subsection-head">
              <strong className="study-mode-title">选择草稿 / 生成草稿</strong>
              <StatusPill tone={syllabus.materialDrafts.length ? 'success' : 'warning'}>
                {syllabus.materialDrafts.length ? '已有草稿' : '暂无草稿'}
              </StatusPill>
            </div>

            {syllabus.materialDrafts.length ? (
              <div className="resource-table">
                <div className="resource-table-head">
                  <span>material_id</span>
                  <span>title</span>
                  <span>create_time</span>
                </div>
                {syllabus.materialDrafts.map((item) => (
                  <button
                    key={item.materialId}
                    type="button"
                    className={`resource-table-row resource-table-button ${item.materialId === state.materialId ? 'is-selected' : ''}`}
                    onClick={() => setState((current) => ({
                      ...current,
                      materialId: item.materialId,
                      draftTitle: item.draft?.material_title ?? item.title,
                      involvedWeeks: cloneData(item.draft?.involved_weeks ?? [4]),
                      draftQuestions: cloneData(item.draft?.questions ?? []),
                      finalQuestions: cloneData(item.finalData?.questions ?? []).map(hydrateFinalQuestion),
                    }))}
                  >
                    <span>{item.materialId}</span>
                    <span>{item.title}</span>
                    <span>{item.createTime}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState>暂无草稿。</EmptyState>
            )}

            <div className="material-setup-grid">
              <label className="field">
                <span>involved_weeks</span>
                <input
                  value={state.involvedWeeks.join(', ')}
                  onChange={(event) => setState((current) => ({
                    ...current,
                    involvedWeeks: event.target.value
                      .split(',')
                      .map((item) => Number(item.trim()))
                      .filter(Boolean),
                  }))}
                />
              </label>
              {['single', 'judge', 'short'].map((key) => (
                <label key={key} className="field">
                  <span>{key}</span>
                  <input
                    value={state.distribution[key]}
                    onChange={(event) => setState((current) => ({
                      ...current,
                      distribution: {
                        ...current.distribution,
                        [key]: Number(event.target.value) || 0,
                      },
                    }))}
                  />
                </label>
              ))}
            </div>

            <div className="tile-actions">
              <Button variant="primary" onClick={onGenerateDraft} disabled={Boolean(state.busy)}>
                {state.busy === 'material-draft' ? '处理中...' : '生成习题草稿'}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {state.step === 1 ? (
        <section className="modal-section">
          <label className="field">
            <span>material_title</span>
            <input
              value={state.draftTitle}
              onChange={(event) => setState((current) => ({ ...current, draftTitle: event.target.value }))}
            />
          </label>
          <div className="editor-list">
            {state.draftQuestions.map((question, index) => (
              <article key={question.question_index} className="editor-card">
                <div className="editor-card-head">
                  <strong>{`Q${question.question_index} · ${String(question.type).toUpperCase()}`}</strong>
                </div>
                <label className="field">
                  <span>related_knowledge</span>
                  <textarea
                    rows="2"
                    value={question.related_knowledge}
                    onChange={(event) => {
                      const next = cloneData(state.draftQuestions);
                      next[index].related_knowledge = event.target.value;
                      setState((current) => ({ ...current, draftQuestions: next }));
                    }}
                  />
                </label>
                <label className="field">
                  <span>query_key</span>
                  <input
                    value={question.query_key}
                    onChange={(event) => {
                      const next = cloneData(state.draftQuestions);
                      next[index].query_key = event.target.value;
                      setState((current) => ({ ...current, draftQuestions: next }));
                    }}
                  />
                </label>
              </article>
            ))}
          </div>
          <div className="tile-actions">
            <Button variant="primary" onClick={onSaveDraft}>保存</Button>
          </div>
        </section>
      ) : null}

      {state.step === 2 ? (
        <section className="modal-section">
          <div className="study-mode">
            <strong className="study-mode-title">生成终稿</strong>
            <div className="processing-panel">
              <span>status</span>
              <strong>
                {state.busy === 'material-final'
                  ? '正在处理...'
                  : state.finalQuestions.length
                    ? '终稿已就绪'
                    : '等待终稿'}
              </strong>
            </div>
            <div className="tile-actions">
              <Button variant="primary" onClick={onGenerateFinal} disabled={Boolean(state.busy)}>
                {state.busy === 'material-final' ? '处理中...' : '生成习题终稿'}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {state.step === 3 ? (
        <section className="modal-section">
          <div className="editor-list">
            {state.finalQuestions.map((question, index) => (
              <article key={question.question_index} className="editor-card">
                <div className="editor-card-head">
                  <strong>{`Q${question.question_index} · ${String(question.type).toUpperCase()}`}</strong>
                  <StatusPill tone="neutral">{question.query_key}</StatusPill>
                </div>
                <label className="field">
                  <span>question_content</span>
                  <textarea
                    rows="2"
                    value={question.question_content ?? ''}
                    onChange={(event) => {
                      const next = cloneData(state.finalQuestions);
                      next[index].question_content = event.target.value;
                      setState((current) => ({ ...current, finalQuestions: next }));
                    }}
                  />
                </label>

                {isSingleQuestion(question) ? (
                  <SingleChoiceOptionsEditor
                    question={question}
                    onChangeOption={(key, value) => {
                      const next = cloneData(state.finalQuestions);
                      next[index].options = ensureSingleOptions(next[index]);
                      next[index].options[key] = value;
                      setState((current) => ({ ...current, finalQuestions: next }));
                    }}
                  />
                ) : null}

                <label className="field">
                  <span>answer</span>
                  {isSingleQuestion(question) ? (
                    <select
                      className="select-field"
                      value={String(question.answer ?? '')}
                      onChange={(event) => {
                        const next = cloneData(state.finalQuestions);
                        next[index].answer = event.target.value;
                        setState((current) => ({ ...current, finalQuestions: next }));
                      }}
                    >
                      <option value="">请选择</option>
                      {['A', 'B', 'C', 'D'].map((key) => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={String(question.answer ?? '')}
                      onChange={(event) => {
                        const next = cloneData(state.finalQuestions);
                        next[index].answer = event.target.value;
                        setState((current) => ({ ...current, finalQuestions: next }));
                      }}
                    />
                  )}
                </label>
              </article>
            ))}
          </div>
          <div className="tile-actions">
            <Button variant="primary" onClick={onSaveFinal}>保存</Button>
          </div>
        </section>
      ) : null}

      {state.step === 4 ? (
        <section className="modal-section">
          <div className="publish-grid">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={state.publish.new_pdf}
                onChange={(event) => setState((current) => ({
                  ...current,
                  publish: { ...current.publish, new_pdf: event.target.checked },
                }))}
              />
              <span>生成新的 PDF</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={state.publish.do_publish}
                onChange={(event) => setState((current) => ({
                  ...current,
                  publish: { ...current.publish, do_publish: event.target.checked },
                }))}
              />
              <span>公开给学生</span>
            </label>
          </div>
          <div className="tile-actions">
            <Button variant="primary" onClick={onPublish}>执行</Button>
          </div>
        </section>
      ) : null}
    </ModalShell>
  );
}

export default function TeacherDashboard({ navigate }) {
  const [syllabuses, setSyllabuses] = useState([]);
  const [graphOptions, setGraphOptions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState('');
  const [buildModal, setBuildModal] = useState({ open: false });
  const [materialModal, setMaterialModal] = useState({ open: false });
  const [materialUploadFiles, setMaterialUploadFiles] = useState([]);
  const [materialUploadBusy, setMaterialUploadBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsBooting(true);
      setError('');

      try {
        const [response, graphs] = await Promise.all([getTeacherDashboardData(), listGraphs()]);
        if (!cancelled) {
          setSyllabuses(response.syllabuses);
          setGraphOptions(graphs);
          setActiveId(response.syllabuses[0]?.syllabusId ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载失败');
        }
      } finally {
        if (!cancelled) {
          window.setTimeout(() => setIsBooting(false), 240);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(
    () => syllabuses.find((item) => item.syllabusId === activeId) ?? syllabuses[0] ?? null,
    [activeId, syllabuses],
  );
  const weakKnowledge = active ? active.graphFileCount <= 2 : true;
  const overviewDisabled = isBooting || !active || active.status.isEduCalendarMissing || weakKnowledge;
  const materialDisabled = isBooting || !active;
  const syllabusProgress = active ? getSyllabusProgress(active.status) : { label: '待创建', tone: 'warning' };
  const materialDraftShelfItems = useMemo(
    () => getMaterialShelfItems(active?.materialDrafts ?? []),
    [active?.materialDrafts],
  );

  const patchActive = (updater) => {
    setSyllabuses((current) =>
      current.map((item) => (item.syllabusId === activeId ? updater(cloneData(item)) : item)),
    );
  };

  const switchSyllabus = (offset) => {
    if (!syllabuses.length) return;
    const currentIndex = syllabuses.findIndex((item) => item.syllabusId === activeId);
    const nextIndex = (currentIndex + offset + syllabuses.length) % syllabuses.length;
    setActiveId(syllabuses[nextIndex].syllabusId);
    setMaterialUploadFiles([]);
    setBuildModal({ open: false });
    setMaterialModal({ open: false });
  };

  const createNewSyllabus = () => {
    const nextId = Math.max(0, ...syllabuses.map((item) => item.syllabusId)) + 1;
    const next = createEmptySyllabus(nextId);
    setSyllabuses((current) => [...current, next]);
    setActiveId(nextId);
    setMaterialUploadFiles([]);
    setBuildModal(createBuildState(next, graphOptions));
  };

  const softRefreshGraphs = async (nextSelectedGraphId = '') => {
    const [response, graphs] = await Promise.all([getTeacherDashboardData(), listGraphs()]);
    setSyllabuses((current) => {
      const localOnly = current.filter((item) => !response.syllabuses.some((row) => row.syllabusId === item.syllabusId));
      return [...response.syllabuses, ...localOnly];
    });
    setGraphOptions(graphs);
    const nextGraph = graphs.find((item) => item.graphId === (nextSelectedGraphId || buildModal.selectedGraphId));
    setBuildModal((current) => ({
      ...current,
      selectedGraphId: nextSelectedGraphId || current.selectedGraphId,
      selectedGraphName: nextGraph?.graphName ?? current.selectedGraphName,
      busy: '',
    }));
  };

  return (
    <>
      <MainLayout
        title="教师 Dashboard"
        actions={(
          <div className="header-actions">
            <Button variant="secondary" onClick={() => navigate('/login')}>返回登录</Button>
            <Button variant="primary" onClick={createNewSyllabus}>创建新的教学大纲</Button>
          </div>
        )}
      >
        <section className="dashboard-shell">
          <section className="dashboard-hero">
            <SyllabusSwitcher
              items={syllabuses}
              activeId={activeId ?? 0}
              onChange={setActiveId}
              onPrev={() => switchSyllabus(-1)}
              onNext={() => switchSyllabus(1)}
              disabled={isBooting || !syllabuses.length}
            />
          </section>

          {error ? <EmptyState>{error}</EmptyState> : null}
          {!error && !active && !isBooting ? <EmptyState>暂无教学大纲。</EmptyState> : null}

          {active ? (
            <section className="dashboard-grid dashboard-grid-teacher">
              <article className="tile-card tile-teal tile-span-full">
                <div className="tile-card-head">
                  <h3>教学大纲总览</h3>
                  <StatusPill tone={weakKnowledge ? 'danger' : 'success'}>
                    {weakKnowledge ? '知识来源过少' : '可交互'}
                  </StatusPill>
                </div>
                <DisabledBlock
                  disabled={overviewDisabled}
                  message={weakKnowledge ? '知识来源过少' : '等待数据加载或教学日历上传'}
                >
                  <WeekAxis items={active.finalData.period} />
                </DisabledBlock>
              </article>

              <div className="teacher-side-stack">
                <article className="tile-card tile-amber tile-third">
                  <div className="tile-card-head">
                    <h3>教学大纲</h3>
                    <StatusPill tone={syllabusProgress.tone}>{syllabusProgress.label}</StatusPill>
                  </div>
                  <DisabledBlock disabled={weakKnowledge} message="知识过少，暂不允许交互">
                    <div className="tile-actions">
                      <Button variant="primary" onClick={() => setBuildModal(createBuildState(active, graphOptions))}>
                        {active.status.isFinalMissing ? '创建教学大纲' : '编辑教学大纲'}
                      </Button>
                    </div>
                  </DisabledBlock>
                </article>

                <article className="tile-card tile-blue tile-third">
                  <div className="tile-card-head">
                    <h3>教学习题构建</h3>
                    <StatusPill tone={materialDisabled || weakKnowledge ? 'warning' : 'success'}>
                      {materialDisabled || weakKnowledge ? '不可用' : '可编辑'}
                    </StatusPill>
                  </div>
                  <DisabledBlock
                    disabled={materialDisabled || weakKnowledge}
                    message={weakKnowledge ? '知识来源过少' : '等待数据加载'}
                  >
                    <MaterialShelf
                      items={materialDraftShelfItems}
                      rows={1}
                      emptyText="暂无习题文件。"
                    />
                    <div className="tile-actions">
                      <Button variant="primary" onClick={() => setMaterialModal(createMaterialState(active))}>
                        打开弹窗
                      </Button>
                    </div>
                  </DisabledBlock>
                </article>
              </div>

              <article className="tile-card tile-slate tile-two-thirds">
                <div className="tile-card-head">
                  <h3>教学材料</h3>
                  <StatusPill tone={materialDisabled ? 'warning' : 'success'}>
                    {`graph-file ${active.graphFiles.length}`}
                  </StatusPill>
                </div>
                <div className="study-mode compact-mode">
                  <FileDropzone
                    files={materialUploadFiles}
                    onFilesChange={setMaterialUploadFiles}
                    multiple
                    compact
                    title="选择教学材料 / dropbox"
                  />
                  <div className="tile-actions">
                    <Button
                      variant="secondary"
                      disabled={materialUploadBusy || !materialUploadFiles.length}
                      onClick={async () => {
                        setMaterialUploadBusy(true);
                        try {
                          const nextFiles = materialUploadFiles.map((file, index) => ({
                            fileId: Date.now() + index,
                            title: file.name,
                            source: 'graph-file',
                            weekLabel: '',
                            tagText: 'pending · upload',
                            tagTone: 'warning',
                          }));
                          patchActive((item) => {
                            item.graphFiles = [...nextFiles, ...item.graphFiles];
                            item.graphFileCount = item.graphFiles.length;
                            return item;
                          });
                          setMaterialUploadFiles([]);
                        } finally {
                          setMaterialUploadBusy(false);
                        }
                      }}
                    >
                      {materialUploadBusy ? '处理中...' : '上传教学材料'}
                    </Button>
                  </div>
                </div>
                <DisabledBlock disabled={materialDisabled} message="等待数据加载">
                  <MaterialShelf items={active.graphFiles} emptyText="暂无 graph-file。" />
                </DisabledBlock>
              </article>
            </section>
          ) : null}
        </section>
      </MainLayout>

      {buildModal.open && active ? (
        <BuildSyllabusModal
          syllabus={active}
          state={buildModal}
          setState={setBuildModal}
          graphOptions={graphOptions}
          onClose={() => setBuildModal({ open: false })}
          onCreateGraph={async () => {
            setBuildModal((current) => ({ ...current, busy: 'graph' }));
            setError('');
            try {
              const response = await createGraph({ graphName: buildModal.newGraphName });
              if (!response.success || !response.graphId) {
                throw new Error(response.errorMessage || '创建图谱失败');
              }
              await softRefreshGraphs(response.graphId);
              setBuildModal((current) => ({
                ...current,
                newGraphName: '',
                selectedGraphId: response.graphId,
                selectedGraphName: response.graphName,
                busy: '',
              }));
            } catch (actionError) {
              setBuildModal((current) => ({ ...current, busy: '' }));
              setError(actionError instanceof Error ? actionError.message : '创建图谱失败');
            }
          }}
          onUpload={async () => {
            setBuildModal((current) => ({ ...current, busy: 'upload' }));
            setError('');
            try {
              await uploadCalendar({
                syllabusId: active.syllabusId,
                graphId: buildModal.selectedGraphId,
              });
              const selectedGraph = graphOptions.find((item) => item.graphId === buildModal.selectedGraphId);
              patchActive((item) => {
                item.status.isEduCalendarMissing = false;
                item.graphId = buildModal.selectedGraphId || item.graphId;
                item.graphName = selectedGraph?.graphName ?? item.graphName;
                return item;
              });
              setBuildModal((current) => ({
                ...current,
                busy: '',
                step: 1,
                selectedGraphName: selectedGraph?.graphName ?? current.selectedGraphName,
                calendarFiles: [],
              }));
            } catch (actionError) {
              setBuildModal((current) => ({ ...current, busy: '' }));
              setError(actionError instanceof Error ? actionError.message : '上传失败');
            }
          }}
          onGenerateDraft={async () => {
            setBuildModal((current) => ({ ...current, busy: 'draft' }));
            setError('');
            try {
              await buildSyllabusDraft({
                syllabusId: active.syllabusId,
                graphId: buildModal.selectedGraphId || active.graphId,
              });
              patchActive((item) => {
                item.status.isDraftMissing = false;
                item.draft.period = cloneData(buildModal.draftPeriod);
                item.graphId = buildModal.selectedGraphId || item.graphId;
                item.graphName = buildModal.selectedGraphName || item.graphName;
                return item;
              });
              setBuildModal((current) => ({ ...current, busy: '', step: 2 }));
            } catch (actionError) {
              setBuildModal((current) => ({ ...current, busy: '' }));
              setError(actionError instanceof Error ? actionError.message : '生成草稿失败');
            }
          }}
          onSaveDraft={async () => {
            setError('');
            try {
              await updateSyllabusDraft({
                syllabusId: active.syllabusId,
                period: buildModal.draftPeriod,
              });
              patchActive((item) => {
                item.title = buildModal.draftTitle;
                item.draft.period = cloneData(buildModal.draftPeriod);
                return item;
              });
              setBuildModal((current) => ({
                ...current,
                finalTitle: current.draftTitle,
                finalDayOne: current.draftDayOne,
                step: 3,
              }));
            } catch (actionError) {
              setError(actionError instanceof Error ? actionError.message : '保存草稿失败');
            }
          }}
          onGenerateFinal={async () => {
            setBuildModal((current) => ({ ...current, busy: 'final' }));
            setError('');
            try {
              const selectedGraph = graphOptions.find(
                (item) => item.graphId === (buildModal.selectedGraphId || active.graphId),
              );
              await buildSyllabus({
                syllabusId: active.syllabusId,
                graphName: selectedGraph?.graphName ?? active.graphName,
              });
              patchActive((item) => {
                item.status.isFinalMissing = false;
                item.graphName = selectedGraph?.graphName ?? item.graphName;
                item.finalData = {
                  title: buildModal.draftTitle,
                  day_one: buildModal.draftDayOne,
                  period: cloneData(buildModal.draftPeriod),
                };
                return item;
              });
              setBuildModal((current) => ({ ...current, busy: '', step: 4 }));
            } catch (actionError) {
              setBuildModal((current) => ({ ...current, busy: '' }));
              setError(actionError instanceof Error ? actionError.message : '生成终稿失败');
            }
          }}
          onSaveFinal={async () => {
            setError('');
            try {
              await updateSyllabus({
                syllabusId: active.syllabusId,
                title: buildModal.finalTitle,
                dayOne: buildModal.finalDayOne,
              });
              patchActive((item) => {
                item.title = buildModal.finalTitle;
                item.finalData = {
                  ...item.finalData,
                  title: buildModal.finalTitle,
                  day_one: buildModal.finalDayOne,
                  period: cloneData(buildModal.draftPeriod),
                };
                return item;
              });
              setBuildModal((current) => ({ ...current, step: 5 }));
            } catch (actionError) {
              setError(actionError instanceof Error ? actionError.message : '保存终稿失败');
            }
          }}
        />
      ) : null}

      {materialModal.open && active ? (
        <MaterialModal
          syllabus={active}
          state={materialModal}
          setState={setMaterialModal}
          onClose={() => setMaterialModal({ open: false })}
          onGenerateDraft={async () => {
            setMaterialModal((current) => ({ ...current, busy: 'material-draft' }));
            setError('');
            try {
              await generateMaterialDraft({
                syllabusId: active.syllabusId,
                involvedWeeks: materialModal.involvedWeeks,
                questionTypeDistribution: materialModal.distribution,
                materialId: materialModal.materialId,
              });
              setMaterialModal((current) => ({ ...current, busy: '', step: 1 }));
            } catch (actionError) {
              setMaterialModal((current) => ({ ...current, busy: '' }));
              setError(actionError instanceof Error ? actionError.message : '生成习题草稿失败');
            }
          }}
          onSaveDraft={async () => {
            setError('');
            try {
              await updateMaterialDraft({
                materialId: materialModal.materialId,
                materialTitle: materialModal.draftTitle,
                involvedWeeks: materialModal.involvedWeeks,
              });
              patchActive((item) => {
                const target = item.materialDrafts.find(
                  (draft) => draft.materialId === materialModal.materialId,
                );
                if (target) {
                  target.draft = {
                    ...target.draft,
                    material_title: materialModal.draftTitle,
                    involved_weeks: cloneData(materialModal.involvedWeeks),
                    questions: cloneData(materialModal.draftQuestions),
                  };
                }
                return item;
              });
              setMaterialModal((current) => ({ ...current, step: 2 }));
            } catch (actionError) {
              setError(actionError instanceof Error ? actionError.message : '保存习题草稿失败');
            }
          }}
          onGenerateFinal={async () => {
            setMaterialModal((current) => ({ ...current, busy: 'material-final' }));
            setError('');
            try {
              await generateFinalMaterial({ materialId: materialModal.materialId });
              const nextQuestions = (
                materialModal.finalQuestions.length
                  ? materialModal.finalQuestions
                  : cloneData(materialModal.draftQuestions)
              ).map(hydrateFinalQuestion);

              patchActive((item) => {
                const target = item.materialDrafts.find(
                  (draft) => draft.materialId === materialModal.materialId,
                );
                if (target) {
                  target.status.isFinalMissing = false;
                  target.finalData = {
                    material_title: materialModal.draftTitle,
                    involved_weeks: cloneData(materialModal.involvedWeeks),
                    questions: cloneData(nextQuestions),
                  };
                }
                return item;
              });

              setMaterialModal((current) => ({
                ...current,
                busy: '',
                finalQuestions: nextQuestions,
                step: 3,
              }));
            } catch (actionError) {
              setMaterialModal((current) => ({ ...current, busy: '' }));
              setError(actionError instanceof Error ? actionError.message : '生成习题终稿失败');
            }
          }}
          onSaveFinal={async () => {
            setError('');
            try {
              await updateFinalMaterial({ materialId: materialModal.materialId });
              patchActive((item) => {
                const target = item.materialDrafts.find(
                  (draft) => draft.materialId === materialModal.materialId,
                );
                if (target) {
                  target.finalData = {
                    ...target.finalData,
                    questions: cloneData(materialModal.finalQuestions),
                  };
                }
                return item;
              });
              setMaterialModal((current) => ({ ...current, step: 4 }));
            } catch (actionError) {
              setError(actionError instanceof Error ? actionError.message : '保存习题终稿失败');
            }
          }}
          onPublish={async () => {
            setError('');
            try {
              await publishMaterial({
                materialId: materialModal.materialId,
                ...materialModal.publish,
              });
              setMaterialModal({ open: false });
            } catch (actionError) {
              setError(actionError instanceof Error ? actionError.message : '发布失败');
            }
          }}
        />
      ) : null}
    </>
  );
}
