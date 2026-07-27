import { useCallback, useEffect, useState } from 'react'
import {
  getConversations,
  getMessages,
  markRead,
  sendMessage,
} from '../api/conversation.js'
import { getUser } from '../utils/auth.js'
import EmptyState from './EmptyState.jsx'
import ErrorAlert from './ErrorAlert.jsx'
import LoadingState from './LoadingState.jsx'

function formatTime(value) {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function MessageWorkspace({ eyebrow, title }) {
  const user = getUser()
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadConversationMessages = useCallback(async (conversationId) => {
    setError('')

    try {
      let result = await getMessages(conversationId)
      const readResult = await markRead(conversationId)
      if (readResult.updated_count > 0) {
        result = await getMessages(conversationId)
      }
      setMessages(result)
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '消息加载失败，请稍后重试。',
      )
    }
  }, [])

  const loadConversations = useCallback(async () => {
    setError('')

    try {
      const result = await getConversations()
      setConversations(result)
      setActiveConversationId((currentId) => {
        const nextId =
          currentId && result.some((item) => item.id === currentId)
            ? currentId
            : result[0]?.id || null
        return nextId
      })
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '会话列表加载失败，请稍后重试。',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (activeConversationId) {
      loadConversationMessages(activeConversationId)
    } else {
      setMessages([])
    }
  }, [activeConversationId, loadConversationMessages])

  useEffect(() => {
    if (!activeConversationId) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      loadConversations()
      loadConversationMessages(activeConversationId)
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [activeConversationId, loadConversationMessages, loadConversations])

  async function handleRefresh() {
    setIsRefreshing(true)
    try {
      await loadConversations()
      if (activeConversationId) {
        await loadConversationMessages(activeConversationId)
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleSend(event) {
    event.preventDefault()
    const trimmedContent = content.trim()

    if (!trimmedContent || !activeConversationId) {
      return
    }

    setError('')
    setIsSending(true)

    try {
      await sendMessage(activeConversationId, trimmedContent)
      setContent('')
      await Promise.all([
        loadConversations(),
        loadConversationMessages(activeConversationId),
      ])
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '消息发送失败，请稍后重试。',
      )
    } finally {
      setIsSending(false)
    }
  }

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )

  return (
    <section className="message-page">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>查看撮合后的会话并发送站内文本消息。</p>
        </div>
        <button
          className="secondary-button compact-button"
          disabled={isRefreshing}
          onClick={handleRefresh}
          type="button"
        >
          {isRefreshing ? '正在刷新…' : '刷新会话'}
        </button>
      </header>

      <ErrorAlert message={error} onRetry={loadConversations} />

      {isLoading ? (
        <LoadingState label="正在加载会话…" />
      ) : conversations.length === 0 ? (
        <EmptyState
          description="家长接受学生投递后，会自动建立站内会话。"
          title="暂无会话"
        />
      ) : (
        <div className="messenger-layout">
          <aside className="conversation-sidebar">
            {conversations.map((conversation) => (
              <button
                className={
                  conversation.id === activeConversationId ? 'active' : undefined
                }
                key={conversation.id}
                onClick={() => setActiveConversationId(conversation.id)}
                type="button"
              >
                <div className="conversation-avatar">
                  {conversation.other_participant?.display_name?.slice(0, 1) || 'T'}
                </div>
                <div>
                  <strong>
                    {conversation.other_participant?.display_name || '会话用户'}
                  </strong>
                  <span>{conversation.demand?.title}</span>
                  <small>
                    {conversation.last_message?.content || '还没有消息'}
                  </small>
                </div>
                <time>{formatTime(conversation.last_message_at)}</time>
              </button>
            ))}
          </aside>

          <section className="chat-panel">
            <header>
              <div>
                <h2>
                  {activeConversation?.other_participant?.display_name || '站内会话'}
                </h2>
                <p>{activeConversation?.demand?.title}</p>
              </div>
              <span>{activeConversation?.status}</span>
            </header>

            <div className="message-history">
              {messages.length === 0 ? (
                <div className="chat-empty">发送第一条消息开始沟通。</div>
              ) : (
                messages.map((message) => {
                  const isMine = message.sender_id === user?.id

                  return (
                    <div
                      className={`message-row ${isMine ? 'message-mine' : ''}`}
                      key={message.id}
                    >
                      <div className="message-bubble">
                        <p>{message.content}</p>
                        <time>{formatTime(message.sent_at)}</time>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <form className="message-composer" onSubmit={handleSend}>
              <textarea
                maxLength="2000"
                onChange={(event) => setContent(event.target.value)}
                placeholder="输入消息…"
                required
                rows="2"
                value={content}
              />
              <button
                className="primary-button"
                disabled={isSending || !content.trim()}
                type="submit"
              >
                {isSending ? '发送中…' : '发送'}
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}

export default MessageWorkspace
