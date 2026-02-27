import React, { useState, useEffect, useRef } from 'react'
import './Sidebar.css'

function Sidebar({ activeTab, onTabChange, isMobileOpen, onMobileClose, isMobileExpanded, onMobileToggle }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'history', label: 'History', icon: 'history' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar_month' },
    { id: 'equity', label: 'Equity Curve', icon: 'show_chart' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ]

  const sidebarRef = useRef(null)
  const backdropRef = useRef(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isDragging = useRef(false)

  // Handle backdrop click to close sidebar on mobile
  useEffect(() => {
    const handleBackdropClick = (e) => {
      if (e.target === backdropRef.current && isMobileExpanded) {
        onMobileToggle()
      }
    }

    const backdrop = backdropRef.current
    if (backdrop) {
      backdrop.addEventListener('click', handleBackdropClick)
      return () => backdrop.removeEventListener('click', handleBackdropClick)
    }
  }, [isMobileExpanded, onMobileToggle])

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobileExpanded) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileExpanded])

  // Enhanced swipe gesture handling
  useEffect(() => {
    if (!sidebarRef.current) return

    const sidebar = sidebarRef.current

    const handleTouchStart = (e) => {
      if (!isMobileExpanded) return
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
      isDragging.current = false
    }

    const handleTouchMove = (e) => {
      if (!isMobileExpanded) return
      const touchX = e.touches[0].clientX
      const touchY = e.touches[0].clientY
      const deltaX = touchX - touchStartX.current
      const deltaY = touchY - touchStartY.current

      // Only start dragging if horizontal movement is greater than vertical
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        isDragging.current = true
        e.preventDefault()
        
        // Only allow dragging to the left (closing)
        if (deltaX < 0) {
          const translateX = Math.max(deltaX, -280)
          sidebar.style.transform = `translateX(${translateX}px)`
          // Update backdrop opacity based on drag
          if (backdropRef.current) {
            const opacity = 1 + (translateX / 280) * 0.3
            backdropRef.current.style.opacity = Math.max(0, opacity)
          }
        }
      }
    }

    const handleTouchEnd = (e) => {
      if (!isMobileExpanded) return
      const touchX = e.changedTouches[0].clientX
      const deltaX = touchX - touchStartX.current

      // If dragged more than 30% of sidebar width, close it
      if (isDragging.current && deltaX < -80) {
        onMobileToggle()
      }

      // Reset transform
      sidebar.style.transform = ''
      if (backdropRef.current) {
        backdropRef.current.style.opacity = ''
      }
      isDragging.current = false
    }

    sidebar.addEventListener('touchstart', handleTouchStart, { passive: false })
    sidebar.addEventListener('touchmove', handleTouchMove, { passive: false })
    sidebar.addEventListener('touchend', handleTouchEnd)

    return () => {
      sidebar.removeEventListener('touchstart', handleTouchStart)
      sidebar.removeEventListener('touchmove', handleTouchMove)
      sidebar.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isMobileExpanded, onMobileToggle])

  const handleItemClick = (id, e) => {
    e.stopPropagation()
    const isMobile = window.innerWidth <= 640
    
    if (isMobile && !isMobileExpanded) {
      onMobileToggle()
      setTimeout(() => onTabChange(id), 150)
    } else {
      onTabChange(id)
      // Auto-close on mobile after selection for better UX
      if (isMobile && isMobileExpanded) {
        setTimeout(() => onMobileToggle(), 200)
      }
    }
  }

  return (
    <>
      {/* Backdrop overlay for mobile */}
      <div 
        ref={backdropRef}
        className={`sidebar-backdrop ${isMobileExpanded ? 'active' : ''}`}
        aria-hidden="true"
      />
      
      <aside 
        ref={sidebarRef}
        className={`sidebar ${isMobileExpanded ? 'mobile-expanded' : ''}`}
      >
        {/* Header with logo */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon-wrapper">
              <span className="material-icons logo-icon">trending_up</span>
            </div>
            <div className="logo-content">
              <span className="logo-text">Trading Tracker</span>
              <span className="logo-subtitle">Track Your Trades</span>
            </div>
          </div>
          <button 
            className="sidebar-close-mobile" 
            onClick={onMobileToggle}
            aria-label="Close menu"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Navigation</div>
            {menuItems.map((item, index) => (
              <button
                key={item.id}
                className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={(e) => handleItemClick(item.id, e)}
                title={item.label}
                aria-label={item.label}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="sidebar-item-icon-wrapper">
                  <span className="material-icons sidebar-item-icon">{item.icon}</span>
                </div>
                <span className="sidebar-item-label">{item.label}</span>
                {activeTab === item.id && (
                  <div className="sidebar-item-indicator">
                    <span className="material-icons">chevron_right</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Footer decoration */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-decoration"></div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
