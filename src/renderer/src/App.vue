<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

interface CourseItem {
  id: string
  name: string
  term: string
}

interface VideoItem {
  title: string
  contentId: string
  duration: number
  fileSize: number
  thumbnailUrl: string
  weekPosition: number
}

const isLoggedIn = ref(false)
const courses = ref<CourseItem[]>([])
const selectedCourseId = ref<string | null>(null)
const videos = ref<VideoItem[]>([])
const isLoading = ref(false)
const message = ref('')
const downloadingIds = ref<Set<string>>(new Set())
const progressMap = ref<Record<string, number>>({})
const downloadFormat = ref<'mp4' | 'mp3'>('mp4')

window.api.onDownloadProgress((data) => {
  progressMap.value[data.contentId] = data.percent
})

onUnmounted(() => {
  window.api.removeDownloadProgress()
})

async function login(): Promise<void> {
  message.value = '로그인 창을 열고 있습니다...'
  const result = await window.api.openLogin()
  if (result.success) {
    isLoggedIn.value = true
    message.value = ''
    fetchCourses()
  } else {
    message.value = '로그인이 취소되었습니다.'
  }
}

async function fetchCourses(): Promise<void> {
  isLoading.value = true
  message.value = '과목 목록을 불러오는 중...'
  courses.value = []
  selectedCourseId.value = null
  videos.value = []

  const result = await window.api.fetchCourses()

  isLoading.value = false

  if (result.success && result.courses) {
    courses.value = result.courses
    message.value = `${result.courses.length}개의 과목을 찾았습니다.`
  } else if (result.error?.includes('로그인')) {
    isLoggedIn.value = false
    message.value = result.error
  } else {
    message.value = result.error || '과목 조회 실패'
  }
}

async function selectCourse(course: CourseItem): Promise<void> {
  selectedCourseId.value = course.id
  isLoading.value = true
  message.value = `${course.name} 강의 영상을 불러오는 중...`
  videos.value = []
  progressMap.value = {}

  const result = await window.api.fetchModules(course.id)

  isLoading.value = false

  if (result.success && result.videos) {
    videos.value = result.videos
    message.value = `${result.videos.length}개의 비디오를 찾았습니다.`
    if (result.videos.length === 0) {
      message.value = '다운로드 가능한 비디오가 없습니다.'
    }
  } else if (result.error?.includes('로그인')) {
    isLoggedIn.value = false
    message.value = result.error
  } else {
    message.value = result.error || '강의 목록 조회 실패'
  }
}

function goBackToCourses(): void {
  selectedCourseId.value = null
  videos.value = []
  progressMap.value = {}
  message.value = ''
}

const isDownloadingAll = ref(false)

async function downloadAll(): Promise<void> {
  if (videos.value.length === 0) return
  isDownloadingAll.value = true
  message.value = '전체 다운로드를 시작합니다...'

  for (const v of videos.value) {
    downloadingIds.value.add(v.contentId)
    progressMap.value[v.contentId] = 0
  }

  const result = await window.api.downloadAll(
    videos.value.map((v) => ({ contentId: v.contentId, title: v.title })),
    downloadFormat.value
  )

  isDownloadingAll.value = false

  if (result.error === 'cancelled') {
    for (const v of videos.value) {
      downloadingIds.value.delete(v.contentId)
      delete progressMap.value[v.contentId]
    }
    message.value = ''
    return
  }

  for (const v of videos.value) {
    downloadingIds.value.delete(v.contentId)
  }

  if (result.success && result.results) {
    for (const r of result.results) {
      const v = videos.value.find((v) => v.title === r.title)
      if (v) {
        progressMap.value[v.contentId] = r.success ? 100 : -1
      }
    }
    message.value = `전체 다운로드 완료: ${result.successCount}/${result.total}개 성공`
  } else {
    message.value = result.error || '전체 다운로드 실패'
  }
}

async function download(video: VideoItem): Promise<void> {
  downloadingIds.value.add(video.contentId)
  progressMap.value[video.contentId] = 0

  const result = await window.api.downloadVideo(video.contentId, video.title, downloadFormat.value)

  downloadingIds.value.delete(video.contentId)

  if (result.success) {
    progressMap.value[video.contentId] = 100
    message.value = `다운로드 완료: ${video.title}`
  } else if (result.error !== 'cancelled') {
    delete progressMap.value[video.contentId]
    message.value = `다운로드 실패 (${video.title}): ${result.error}`
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}분 ${s}초`
}

function formatSize(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
</script>

<template>
  <div class="container">
    <h1>숭실 LMS 비디오 다운로더</h1>

    <!-- 로그인 -->
    <div v-if="!isLoggedIn" class="section">
      <p class="desc">Canvas LMS에 로그인하여 강의 비디오를 다운로드하세요.</p>
      <button class="btn primary" @click="login">LMS 로그인</button>
    </div>

    <!-- 로그인 후 -->
    <template v-else>
      <!-- 과목 목록 (과목 미선택 시) -->
      <div v-if="selectedCourseId === null" class="section">
        <div class="toolbar">
          <button class="btn primary" :disabled="isLoading" @click="fetchCourses">
            {{ isLoading ? '조회 중...' : '과목 새로고침' }}
          </button>
          <button class="btn secondary" @click="login">재로그인</button>
        </div>

        <div v-if="courses.length > 0" class="course-list">
          <div
            v-for="course in courses"
            :key="course.id"
            class="course-card"
            @click="selectCourse(course)"
          >
            <div class="course-info">
              <div class="course-name">{{ course.name }}</div>
              <div class="course-meta">{{ course.term }}</div>
            </div>
            <span class="arrow">→</span>
          </div>
        </div>
      </div>

      <!-- 비디오 목록 (과목 선택 후) -->
      <div v-else class="section">
        <div class="toolbar">
          <button class="btn secondary" @click="goBackToCourses">← 과목 목록</button>
          <div class="toolbar-right">
            <div class="format-toggle">
              <button
                class="toggle-btn"
                :class="{ active: downloadFormat === 'mp4' }"
                @click="downloadFormat = 'mp4'"
              >
                MP4
              </button>
              <button
                class="toggle-btn"
                :class="{ active: downloadFormat === 'mp3' }"
                @click="downloadFormat = 'mp3'"
              >
                MP3
              </button>
            </div>
            <button
              v-if="videos.length > 0"
              class="btn primary"
              :disabled="isDownloadingAll || isLoading"
              @click="downloadAll"
            >
              {{ isDownloadingAll ? '다운로드 중...' : '전체 다운로드' }}
            </button>
          </div>
        </div>

        <div v-if="videos.length > 0" class="video-list">
          <div v-for="video in videos" :key="video.contentId" class="video-card">
            <img
              v-if="video.thumbnailUrl"
              :src="video.thumbnailUrl"
              class="thumbnail"
              alt="thumbnail"
            />
            <div class="video-info">
              <div class="video-title">{{ video.title }}</div>
              <div class="video-meta">
                {{ video.weekPosition }}주차 · {{ formatDuration(video.duration) }} ·
                {{ formatSize(video.fileSize) }}
              </div>
              <div v-if="downloadingIds.has(video.contentId)" class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: (progressMap[video.contentId] || 0) + '%' }"
                ></div>
              </div>
              <div v-else-if="progressMap[video.contentId] === 100" class="done-label">
                다운로드 완료
              </div>
            </div>
            <button
              class="btn small"
              :disabled="downloadingIds.has(video.contentId)"
              @click="download(video)"
            >
              {{ downloadingIds.has(video.contentId) ? `${progressMap[video.contentId] || 0}%` : '다운로드' }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- 상태 메시지 -->
    <p v-if="message" class="message">{{ message }}</p>
  </div>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  overflow: hidden;
}
</style>

<style scoped>
.container {
  max-width: 700px;
  margin: 0 auto;
  padding: 20px 20px 30px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

h1 {
  font-size: 1.4rem;
  margin-bottom: 20px;
  color: #222;
}

.section {
  margin-bottom: 16px;
}

.desc {
  font-size: 0.9rem;
  color: #555;
  margin-bottom: 12px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-row label {
  font-size: 0.85rem;
  color: #555;
}

.term-input {
  width: 70px;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 0.85rem;
}

.term-input:focus {
  outline: none;
  border-color: #4a90d9;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
}

.btn.primary {
  background: #4a90d9;
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background: #3a7bc8;
}

.btn.small {
  padding: 6px 14px;
  font-size: 0.8rem;
  background: #4a90d9;
  color: white;
}

.btn.small:hover:not(:disabled) {
  background: #3a7bc8;
}

.btn.secondary {
  background: #e0e0e0;
  color: #333;
  padding: 8px 16px;
}

.btn.secondary:hover {
  background: #d0d0d0;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.format-toggle {
  display: flex;
  border: 1px solid #ccc;
  border-radius: 6px;
  overflow: hidden;
}

.toggle-btn {
  padding: 6px 12px;
  border: none;
  background: #f5f5f5;
  font-size: 0.8rem;
  cursor: pointer;
  color: #555;
}

.toggle-btn.active {
  background: #4a90d9;
  color: white;
}

.toggle-btn:not(.active):hover {
  background: #e0e0e0;
}

.message {
  font-size: 0.85rem;
  color: #555;
  margin: 12px 0;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 6px;
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.course-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
  cursor: pointer;
  transition: border-color 0.15s;
}

.course-card:hover {
  border-color: #4a90d9;
  background: #f0f6ff;
}

.course-info {
  flex: 1;
  min-width: 0;
}

.course-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-meta {
  font-size: 0.75rem;
  color: #888;
  margin-top: 4px;
}

.arrow {
  color: #aaa;
  font-size: 1.1rem;
  flex-shrink: 0;
  margin-left: 12px;
}

.video-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.video-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
}

.thumbnail {
  width: 80px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.video-info {
  flex: 1;
  min-width: 0;
}

.video-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-meta {
  font-size: 0.75rem;
  color: #888;
  margin-top: 4px;
}

.progress-bar {
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
  margin-top: 6px;
}

.progress-fill {
  height: 100%;
  background: #4a90d9;
  transition: width 0.2s;
}

.done-label {
  font-size: 0.75rem;
  color: #27ae60;
  margin-top: 4px;
}
</style>
