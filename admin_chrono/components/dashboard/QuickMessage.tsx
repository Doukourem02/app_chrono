'use client'

interface MessageContact {
  id: string
  name: string
  avatar: string
  status: 'online' | 'offline'
  lastSeen: string
  unreadCount?: number
}

const contacts: MessageContact[] = [
  {
    id: '1',
    name: 'Ethan',
    avatar: 'E',
    status: 'online',
    lastSeen: '12/12/24',
    unreadCount: 2,
  },
  {
    id: '2',
    name: 'Ricky',
    avatar: 'R',
    status: 'offline',
    lastSeen: '11/12/24',
  },
]

const totalOnline = 24

export default function QuickMessage() {
  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
    flex: 0.8,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
    flexShrink: 0,
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827',
  }

  const onlineBadgeStyle: React.CSSProperties = {
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '4px',
    paddingBottom: '4px',
    backgroundColor: '#D1FAE5',
    color: '#16A34A',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
  }

  const contactsListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
  }

  const contactItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  }

  const avatarContainerStyle: React.CSSProperties = {
    position: 'relative',
  }

  const avatarStyle: React.CSSProperties = {
    width: '48px',
    height: '48px',
    backgroundColor: '#9333EA',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '14px',
  }

  const onlineIndicatorStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '12px',
    height: '12px',
    backgroundColor: '#22C55E',
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
  }

  const contactInfoStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  }

  const contactHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
  }

  const contactNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
  }

  const unreadBadgeStyle: React.CSSProperties = {
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '4px',
    paddingBottom: '4px',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '4px',
  }

  const contactStatusStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6B7280',
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>Quick Message</h2>
        <span style={onlineBadgeStyle}>
          {totalOnline} Online
        </span>
      </div>

      <div style={contactsListStyle}>
        {contacts.map((contact) => (
          <div
            key={contact.id}
            style={contactItemStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F9FAFB'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <div style={avatarContainerStyle}>
              <div style={avatarStyle}>
                {contact.avatar}
              </div>
              {contact.status === 'online' && (
                <div style={onlineIndicatorStyle}></div>
              )}
            </div>
            <div style={contactInfoStyle}>
              <div style={contactHeaderStyle}>
                <p style={contactNameStyle}>{contact.name}</p>
                {contact.unreadCount && (
                  <span style={unreadBadgeStyle}>
                    {contact.unreadCount} new message
                  </span>
                )}
              </div>
              <p style={contactStatusStyle}>
                {contact.status === 'online' ? 'Online' : 'Offline'} {contact.lastSeen}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

