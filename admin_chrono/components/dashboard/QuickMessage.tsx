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

export default function QuickMessage() {
  const onlineCount = contacts.filter((c) => c.status === 'online').length

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Quick Message</h2>
        <span className="px-3 py-1 bg-green-100 text-green-600 rounded-lg text-xs font-semibold">
          {onlineCount} Online
        </span>
      </div>

      <div className="space-y-4">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="relative">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {contact.avatar}
              </div>
              {contact.status === 'online' && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-900">{contact.name}</p>
                {contact.unreadCount && (
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full">
                    {contact.unreadCount} new message
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {contact.status === 'online' ? 'Online' : 'Offline'} {contact.lastSeen}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

