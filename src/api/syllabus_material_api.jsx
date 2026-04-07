import {
  RAW_MATERIAL_DETAIL_RESPONSES,
  RAW_MATERIAL_DRAFT_DETAIL_RESPONSES,
  RAW_MATERIAL_LIST_RESPONSES,
  RAW_MATERIAL_STATUS_RESPONSES,
  RAW_TEACHER_DETAIL_RESPONSES,
  RAW_TEACHER_LIST_RESPONSE,
  RAW_TEACHER_STATUS_RESPONSES,
} from './mock_payloads';
import { listGraphFiles, listSyllabusFiles } from './file_transmit_api';
import { getJobLabel, getJobTone, listJobs } from './job_api';

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInitialGraphStore() {
  const rows = Array.isArray(RAW_TEACHER_LIST_RESPONSE?.syllabuses)
    ? RAW_TEACHER_LIST_RESPONSE.syllabuses
    : [];

  return rows
    .filter((row) => row.graph_id != null && row.graph_name)
    .map((row) => ({
      graph_id: row.graph_id,
      graph_name: row.graph_name,
    }));
}

let mockGraphStore = createInitialGraphStore();

function parseSyllabusStatusResponse(response) {
  return {
    isEduCalendarMissing: Boolean(response?.status?.is_edu_calendar_path_null),
    isDraftMissing: Boolean(response?.status?.is_syllabus_draft_path_null),
    isFinalMissing: Boolean(response?.status?.is_syllabus_path_null),
  };
}

function parseMaterialStatusResponse(response) {
  return {
    isDraftMissing: Boolean(response?.status?.is_material_draft_path_null),
    isFinalMissing: Boolean(response?.status?.is_material_path_null),
  };
}

function parseSyllabusListResponse(response) {
  const rows = Array.isArray(response?.syllabuses) ? response.syllabuses : [];

  return rows.map((row) => ({
    syllabusId: row.syllabus_id,
    title: row.title,
    permission: row.syllabus_permission,
    graphId: row.graph_id,
    graphName: row.graph_name,
    dayOneTime: row.day_one_time,
    eduCalendarPath: row.edu_calendar_path,
    draftPath: row.syllabus_draft_path,
    finalPath: row.syllabus_path,
  }));
}

function parseSyllabusDetailResponse(response) {
  const payload = response?.syllabus ?? {};
  const syllabus = payload?.syllabus ?? {};

  return {
    syllabus: {
      syllabusId: syllabus.syllabus_id,
      title: syllabus.title,
      graphName: syllabus.graph_name,
      dayOneTime: syllabus.day_one_time,
      eduCalendarPath: syllabus.edu_calendar_path,
      draftPath: syllabus.syllabus_draft_path,
      finalPath: syllabus.syllabus_path,
    },
    draft: payload?.draft ?? null,
    finalData: payload?.final ?? null,
  };
}

function parseMaterialListResponse(response) {
  const rows = Array.isArray(response?.materials) ? response.materials : [];

  return rows.map((row) => ({
    materialId: row.material_id,
    title: row.title,
    draftPath: row.draft_path,
    finalPath: row.final_path,
    pdfPath: row.pdf_path,
    createTime: row.create_time,
  }));
}

function parseMaterialDetailResponse(response) {
  return response?.material ?? null;
}

function parseMaterialDraftResponse(response) {
  return response?.material ?? null;
}

function parseSyllabusMutationResponse(response) {
  return {
    success: Boolean(response?.success),
    syllabusId: response?.syllabus?.syllabus_id ?? null,
    fileId: response?.file?.file_id ?? null,
    errorMessage: response?.error_message ?? '',
    errorCode: response?.error_code ?? '',
  };
}

function parseGraphListResponse(response) {
  const rows = Array.isArray(response?.graphs) ? response.graphs : [];

  return rows.map((row) => ({
    graphId: row.graph_id,
    graphName: row.graph_name,
  }));
}

function parseGraphMutationResponse(response) {
  return {
    success: Boolean(response?.success),
    graphId: response?.graph?.graph_id ?? null,
    graphName: response?.graph?.graph_name ?? '',
    errorMessage: response?.error_message ?? '',
    errorCode: response?.error_code ?? '',
  };
}

function parseMaterialMutationResponse(response) {
  return {
    success: Boolean(response?.success),
    materialId: response?.material?.material_id ?? null,
    errorMessage: response?.error_message ?? '',
    errorCode: response?.error_code ?? '',
  };
}

function mapGraphFiles(graphFiles, jobs) {
  return graphFiles.map((file) => {
    const job = jobs.find((item) => item.fileId === file.fileId) ?? null;

    return {
      fileId: file.fileId,
      title: file.title,
      source: file.source,
      weekLabel: file.weekIndexList.length ? `第 ${file.weekIndexList.join(', ')} 周` : '',
      tagText: job ? getJobLabel(job) : '',
      tagTone: job ? getJobTone(job.status) : 'neutral',
      job,
    };
  });
}

function mapMaterialShelf(syllabusFiles, graphFiles) {
  const syllabusItems = syllabusFiles.map((file) => ({
    fileId: file.fileId,
    title: file.title,
    source: file.source,
    weekLabel: file.weekIndexList.length ? `第 ${file.weekIndexList.join(', ')} 周` : '',
  }));

  return [...syllabusItems, ...graphFiles];
}

export async function listSyllabusesRaw() {
  return cloneData(RAW_TEACHER_LIST_RESPONSE);
}

export async function getSyllabusDetailRaw(syllabusId) {
  return cloneData(RAW_TEACHER_DETAIL_RESPONSES[syllabusId]);
}

export async function getSyllabusStatusRaw(syllabusId) {
  return cloneData(RAW_TEACHER_STATUS_RESPONSES[syllabusId]);
}

export async function listMaterialsRaw(syllabusId) {
  return cloneData(RAW_MATERIAL_LIST_RESPONSES[syllabusId] ?? { success: true, materials: [] });
}

export async function getMaterialDraftDetailRaw(materialId) {
  return cloneData(RAW_MATERIAL_DRAFT_DETAIL_RESPONSES[materialId] ?? { success: true, material: null });
}

export async function getMaterialDetailRaw(materialId) {
  return cloneData(RAW_MATERIAL_DETAIL_RESPONSES[materialId] ?? { success: true, material: null });
}

export async function getMaterialStatusRaw(materialId) {
  return cloneData(
    RAW_MATERIAL_STATUS_RESPONSES[materialId] ?? {
      success: true,
      status: {
        is_material_draft_path_null: true,
        is_material_path_null: true,
      },
      error_message: '',
      error_code: '',
    },
  );
}

export async function getTeacherDashboardData() {
  const syllabusList = parseSyllabusListResponse(await listSyllabusesRaw());

  const syllabuses = await Promise.all(
    syllabusList.map(async (item) => {
      const detail = parseSyllabusDetailResponse(await getSyllabusDetailRaw(item.syllabusId));
      const status = parseSyllabusStatusResponse(await getSyllabusStatusRaw(item.syllabusId));
      const rawGraphFiles = await listGraphFiles(item.graphId ? [item.graphId] : []);
      const jobs = item.graphId ? await listJobs(item.graphId) : [];
      const graphFiles = mapGraphFiles(rawGraphFiles, jobs);
      const syllabusFiles = await listSyllabusFiles([item.syllabusId]);
      const materialList = parseMaterialListResponse(await listMaterialsRaw(item.syllabusId));

      const materialDrafts = await Promise.all(
        materialList.map(async (material) => ({
          ...material,
          draft: parseMaterialDraftResponse(await getMaterialDraftDetailRaw(material.materialId)),
          finalData: material.finalPath ? parseMaterialDetailResponse(await getMaterialDetailRaw(material.materialId)) : null,
          status: parseMaterialStatusResponse(await getMaterialStatusRaw(material.materialId)),
        })),
      );

      return {
        syllabusId: item.syllabusId,
        title: detail.syllabus.title ?? item.title,
        permission: item.permission,
        graphId: item.graphId,
        graphName: detail.syllabus.graphName ?? item.graphName,
        dayOneTime: detail.syllabus.dayOneTime ?? item.dayOneTime,
        status,
        draft: detail.draft ?? { period: [] },
        finalData: detail.finalData ?? { title: detail.syllabus.title ?? item.title, day_one: '', period: [] },
        graphFiles,
        graphFileCount: graphFiles.filter((file) => !file.job || file.job.status !== 'failed').length,
        syllabusFiles,
        materialDrafts,
        materialShelf: mapMaterialShelf(syllabusFiles, graphFiles),
      };
    }),
  );

  return { syllabuses };
}

export async function listGraphsRaw() {
  return cloneData({
    success: true,
    graphs: mockGraphStore,
    error_message: '',
    error_code: '',
  });
}

export async function createGraphRaw(payload = {}) {
  const graphName = String(payload.graphName ?? '').trim();

  if (!graphName) {
    return {
      success: false,
      graph: null,
      error_message: 'graph_name_required',
      error_code: 'graph_name_required',
    };
  }

  const existing = mockGraphStore.find((item) => item.graph_name === graphName);
  if (existing) {
    return {
      success: true,
      graph: existing,
      error_message: '',
      error_code: '',
    };
  }

  const nextId = Math.max(0, ...mockGraphStore.map((item) => item.graph_id)) + 1;
  const graph = {
    graph_id: nextId,
    graph_name: graphName,
  };

  mockGraphStore = [...mockGraphStore, graph];

  return {
    success: true,
    graph,
    error_message: '',
    error_code: '',
  };
}

export async function listGraphs() {
  return parseGraphListResponse(await listGraphsRaw());
}

export async function createGraph(payload = {}) {
  return parseGraphMutationResponse(await createGraphRaw(payload));
}

export async function uploadCalendar(payload = {}) {
  return parseSyllabusMutationResponse({
    success: true,
    file: { file_id: 901 },
    syllabus: { syllabus_id: payload.syllabusId ?? 3 },
    error_message: '',
    error_code: '',
  });
}

export async function buildSyllabusDraft(payload = {}) {
  return parseSyllabusMutationResponse({
    success: true,
    syllabus: { syllabus_id: payload.syllabusId ?? null },
    error_message: '',
    error_code: '',
  });
}

export async function updateSyllabusDraft(payload = {}) {
  return parseSyllabusMutationResponse({
    success: true,
    syllabus: { syllabus_id: payload.syllabusId ?? null },
    error_message: '',
    error_code: '',
  });
}

export async function buildSyllabus(payload = {}) {
  return parseSyllabusMutationResponse({
    success: true,
    syllabus: { syllabus_id: payload.syllabusId ?? null },
    error_message: '',
    error_code: '',
  });
}

export async function updateSyllabus(payload = {}) {
  return parseSyllabusMutationResponse({
    success: true,
    syllabus: { syllabus_id: payload.syllabusId ?? null },
    error_message: '',
    error_code: '',
  });
}

export async function generateMaterialDraft(payload = {}) {
  return parseMaterialMutationResponse({
    success: true,
    material: { material_id: payload.materialId ?? 101 },
    error_message: '',
    error_code: '',
  });
}

export async function updateMaterialDraft(payload = {}) {
  return parseMaterialMutationResponse({
    success: true,
    material: { material_id: payload.materialId ?? null },
    error_message: '',
    error_code: '',
  });
}

export async function generateFinalMaterial(payload = {}) {
  return parseMaterialMutationResponse({
    success: true,
    material: { material_id: payload.materialId ?? null },
    error_message: '',
    error_code: '',
  });
}

export async function updateFinalMaterial(payload = {}) {
  return parseMaterialMutationResponse({
    success: true,
    material: { material_id: payload.materialId ?? null },
    error_message: '',
    error_code: '',
  });
}

export async function publishMaterial(payload = {}) {
  return parseMaterialMutationResponse({
    success: true,
    material: { material_id: payload.materialId ?? null },
    error_message: '',
    error_code: '',
  });
}

export {
  parseGraphListResponse,
  parseGraphMutationResponse,
  parseMaterialDetailResponse,
  parseMaterialDraftResponse,
  parseMaterialListResponse,
  parseMaterialMutationResponse,
  parseMaterialStatusResponse,
  parseSyllabusDetailResponse,
  parseSyllabusListResponse,
  parseSyllabusMutationResponse,
  parseSyllabusStatusResponse,
};
