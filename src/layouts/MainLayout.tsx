import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileTabBar from '../components/MobileTabBar'
import styles from './MainLayout.module.css'

interface Props {
  children: ReactNode
  rightPanel?: ReactNode
}

export default function MainLayout({ children, rightPanel }: Props) {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <Topbar />
        <div className={styles.body}>
          <div className={styles.content}>{children}</div>
          {rightPanel}
        </div>
      </div>
      <MobileTabBar />
    </div>
  )
}
