import { useEffect, useState } from 'react'
import ProjectsScreen from './components/ProjectsScreen'
import EditorScreen from './components/EditorScreen'
import ConfirmDialog from './components/Dialogs/ConfirmDialog'
import AddClassDialog from './components/Dialogs/AddClassDialog'
import AddPropertyDialog from './components/Dialogs/AddPropertyDialog'
import AddDatatypeDialog from './components/Dialogs/AddDatatypeDialog'
import Toast from './components/common/Toast'
import ErrorBoundary from './components/common/ErrorBoundary'
import DocsDialog from './components/Docs/DocsDialog'
import AuthDialog from './components/AuthDialog'
import { useAuthStore } from './store/authStore'

export default function App() {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const bootstrap = useAuthStore((s) => s.bootstrap)

  // 启动时恢复登录会话
  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return (
    <>
      <ErrorBoundary title="编辑器出现异常" onReset={() => setCurrentProjectId(null)}>
        {currentProjectId ? (
          <EditorScreen projectId={currentProjectId} onBack={() => setCurrentProjectId(null)} />
        ) : (
          <ProjectsScreen onOpenProject={setCurrentProjectId} />
        )}
      </ErrorBoundary>

      {/* 全局对话框与提示 */}
      <AddClassDialog />
      <AddPropertyDialog />
      <AddDatatypeDialog />
      <ConfirmDialog />
      <DocsDialog />
      <AuthDialog />
      <Toast />
    </>
  )
}
