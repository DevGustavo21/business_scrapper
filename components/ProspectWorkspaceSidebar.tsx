'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clock, ListTodo, MessageSquare } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  fetchProfileEmail,
  fetchProspectListMembersForMentions,
  fetchProspectSearchCollaboratorsForMentions,
  type ProspectListMemberRow,
} from '@/lib/supabase/collaboration'
import {
  insertProspectTaskForTarget,
  insertThreadMessageForTarget,
  listActivityForTarget,
  listProspectTasksForTarget,
  listThreadMessagesForTarget,
  updateProspectTaskAssignee,
  updateProspectTaskDone,
  type ProspectActivityEventRow,
  type ProspectTaskRow,
  type ProspectThreadMessageRow,
  type WorkspaceThreadTarget,
} from '@/lib/supabase/prospectDetail'
import { cn } from '@/lib/utils'

const panelClass =
  'rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-3 bg-neutral-50/50 dark:bg-neutral-950/40 overflow-hidden'

function mentionToken(memberEmail: string) {
  return `@${memberEmail}`
}

const AVATAR_HUES = [
  'bg-violet-600',
  'bg-sky-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-fuchsia-600',
  'bg-teal-600',
] as const

function avatarHueClass(userId: string) {
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h + userId.charCodeAt(i)) % AVATAR_HUES.length
  return AVATAR_HUES[h]
}

/** Iniciales para avatar (correo o fallback) */
function avatarInitials(fromEmail: string) {
  const s = fromEmail.trim()
  if (!s || s === '…') return '?'
  const local = s.split('@')[0] ?? s
  if (local.length >= 2) return local.slice(0, 2).toUpperCase()
  return local.slice(0, 1).toUpperCase()
}

function renderMessageBody(
  body: string,
  members: ProspectListMemberRow[],
  variant: 'incoming' | 'outgoing',
) {
  const tokens = new Set(members.map(m => mentionToken(m.email)))
  const mentionCls =
    variant === 'outgoing'
      ? 'font-semibold text-emerald-50 underline decoration-emerald-200/90 underline-offset-2'
      : 'font-semibold text-indigo-700 dark:text-indigo-300'
  const parts = body.split(/(\s+)/)
  return parts.map((part, i) => {
    const trimmed = part.trim()
    if (tokens.has(trimmed)) {
      return (
        <span key={i} className={mentionCls}>
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

type Props = {
  target: WorkspaceThreadTarget
  prospectListId: string | null
  prospectOwnerId: string | null
  userId: string | null
  loggedIn: boolean
  refreshKey?: number
  onError?: (msg: string) => void
}

export function ProspectWorkspaceSidebar({
  target,
  prospectListId,
  prospectOwnerId,
  userId,
  loggedIn,
  refreshKey = 0,
  onError,
}: Props) {
  const sb = useMemo(() => createBrowserSupabaseClient(), [])
  const [members, setMembers] = useState<ProspectListMemberRow[]>([])
  const [messages, setMessages] = useState<ProspectThreadMessageRow[]>([])
  const [tasks, setTasks] = useState<ProspectTaskRow[]>([])
  const [events, setEvents] = useState<ProspectActivityEventRow[]>([])
  const [msgBody, setMsgBody] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskAssignTo, setTaskAssignTo] = useState<string>('')
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionPick, setMentionPick] = useState<ProspectListMemberRow[]>([])
  const taRef = useRef<HTMLTextAreaElement>(null)

  const loadMembers = useCallback(async () => {
    if (target.kind === 'search_row') {
      const { data, error } = await fetchProspectSearchCollaboratorsForMentions(sb, target.searchId)
      if (error) onError?.(error.message)
      setMembers(data)
      return
    }
    if (prospectListId) {
      const { data, error } = await fetchProspectListMembersForMentions(sb, prospectListId)
      if (error) onError?.(error.message)
      setMembers(data)
      return
    }
    if (prospectOwnerId) {
      const { email, error } = await fetchProfileEmail(sb, prospectOwnerId)
      if (error) onError?.(error.message)
      if (email) setMembers([{ user_id: prospectOwnerId, email }])
      else setMembers([])
    } else setMembers([])
  }, [sb, target, prospectListId, prospectOwnerId, onError])

  const loadWorkspace = useCallback(async () => {
    const [m, t, a] = await Promise.all([
      listThreadMessagesForTarget(sb, target),
      listProspectTasksForTarget(sb, target),
      listActivityForTarget(sb, target),
    ])
    if (m.error) onError?.(m.error.message)
    else setMessages(m.data ?? [])
    if (t.error) onError?.(t.error.message)
    else setTasks(t.data ?? [])
    if (a.error) onError?.(a.error.message)
    else setEvents(a.data ?? [])
  }, [sb, target, onError])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace, refreshKey])

  const updateMentionUi = (text: string, cursor: number) => {
    const before = text.slice(0, cursor)
    const at = before.lastIndexOf('@')
    if (at < 0) {
      setMentionOpen(false)
      return
    }
    const frag = before.slice(at + 1)
    if (/\s/.test(frag)) {
      setMentionOpen(false)
      return
    }
    const q = frag.toLowerCase()
    const pool = members.filter(m => !q || m.email.toLowerCase().includes(q))
    setMentionPick(pool.slice(0, 6))
    setMentionOpen(pool.length > 0)
  }

  const onMsgChange = (text: string) => {
    setMsgBody(text)
    const el = taRef.current
    const cursor = el?.selectionStart ?? text.length
    updateMentionUi(text, cursor)
  }

  const insertMention = (member: ProspectListMemberRow) => {
    const el = taRef.current
    const text = msgBody
    const cursor = el?.selectionStart ?? text.length
    const before = text.slice(0, cursor)
    const at = before.lastIndexOf('@')
    if (at < 0) return
    const token = mentionToken(member.email)
    const next = text.slice(0, at) + token + ' ' + text.slice(cursor)
    setMsgBody(next)
    setMentionOpen(false)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = at + token.length + 1
      el.setSelectionRange(pos, pos)
    })
  }

  const sendMsg = async () => {
    if (!userId || !loggedIn || !msgBody.trim()) return
    const { error } = await insertThreadMessageForTarget(sb, target, userId, msgBody)
    if (error) onError?.(error.message)
    else {
      setMsgBody('')
      const m = await listThreadMessagesForTarget(sb, target)
      if (!m.error) setMessages(m.data ?? [])
    }
  }

  const addTask = async () => {
    if (!userId || !loggedIn || !taskTitle.trim()) return
    const assign = taskAssignTo || null
    const { error } = await insertProspectTaskForTarget(sb, target, userId, taskTitle, assign)
    if (error) onError?.(error.message)
    else {
      setTaskTitle('')
      setTaskAssignTo('')
      const t = await listProspectTasksForTarget(sb, target)
      if (!t.error) setTasks(t.data ?? [])
    }
  }

  const toggleTask = async (taskId: string, done: boolean) => {
    const { error } = await updateProspectTaskDone(sb, taskId, done)
    if (error) onError?.(error.message)
    else setTasks(prev => prev.map(x => (x.id === taskId ? { ...x, done } : x)))
  }

  const assignTask = async (taskId: string, assignedTo: string) => {
    const v = assignedTo || null
    const { error } = await updateProspectTaskAssignee(sb, taskId, v)
    if (error) onError?.(error.message)
    else setTasks(prev => prev.map(x => (x.id === taskId ? { ...x, assigned_to: v } : x)))
  }

  const memberById = useMemo(
    () => new Map(members.map(m => [m.user_id, m.email] as const)),
    [members],
  )

  return (
    <aside className="lg:w-[400px] shrink-0 flex flex-col gap-4 lg:sticky lg:top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
      {!loggedIn && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl px-3 py-2">
          Inicia sesión para mensajes, tareas y cronología en este negocio.
        </p>
      )}

      <div className={panelClass}>
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Clock size={16} className="text-indigo-500" />
          Cronología
        </h2>
        <ul className="flex flex-col gap-2 max-h-[220px] overflow-y-auto text-xs">
          {events.length === 0 && <li className="text-neutral-500">Sin eventos todavía.</li>}
          {events.map(ev => (
            <li
              key={ev.id}
              className="border-l-2 border-indigo-200 dark:border-indigo-800 pl-3 py-0.5 text-neutral-700 dark:text-neutral-300"
            >
              {ev.event_type === 'estado_changed' && ev.meta?.to_estado ? (
                <>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">Estado</span>
                  <span className="text-neutral-500">
                    {' '}
                    → {ev.meta.to_estado}
                    {ev.meta.from_estado ? ` (antes: ${ev.meta.from_estado})` : ''}
                  </span>
                </>
              ) : (
                <span>Evento</span>
              )}
              <p className="text-[10px] text-neutral-400 mt-0.5">
                {new Date(ev.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className={cn(panelClass, 'relative')}>
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <MessageSquare size={16} className="text-indigo-500" />
          Mensajes
        </h2>
        {members.length > 0 && (
          <p className="text-[10px] text-neutral-500 leading-snug">
            Escribe <strong>@</strong> para mencionar a alguien del espacio de trabajo (aparecerá resaltado).
          </p>
        )}
        <div className="flex-1 overflow-y-auto max-h-[240px] flex flex-col gap-3 text-xs">
          {messages.length === 0 && <p className="text-neutral-500">Aún no hay mensajes.</p>}
          {messages.map(m => {
            const isOwn = Boolean(userId && m.user_id === userId)
            const senderEmail = memberById.get(m.user_id) ?? '…'
            const initials = avatarInitials(senderEmail)
            return (
              <div
                key={m.id}
                className={cn('flex w-full gap-2 items-end', isOwn ? 'flex-row-reverse' : 'flex-row')}
              >
                <div
                  className={cn(
                    'shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm',
                    avatarHueClass(m.user_id),
                  )}
                  title={senderEmail}
                  aria-label={`Mensaje de ${senderEmail}`}
                >
                  {initials}
                </div>
                <div
                  className={cn(
                    'min-w-0 max-w-[85%] rounded-2xl px-3 py-2 shadow-sm border',
                    isOwn
                      ? 'bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-500/80 dark:border-emerald-600 rounded-br-md'
                      : 'bg-neutral-100 dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-100 border-neutral-200/80 dark:border-neutral-700 rounded-bl-md',
                  )}
                >
                  {!isOwn && (
                    <p className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 truncate">
                      {senderEmail}
                    </p>
                  )}
                  <p className={cn('whitespace-pre-wrap break-words leading-relaxed', isOwn ? 'text-white' : '')}>
                    {renderMessageBody(m.body, members, isOwn ? 'outgoing' : 'incoming')}
                  </p>
                  <p
                    className={cn(
                      'text-[10px] mt-1.5 tabular-nums',
                      isOwn ? 'text-emerald-100/90' : 'text-neutral-400 dark:text-neutral-500',
                    )}
                  >
                    {new Date(m.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        {mentionOpen && mentionPick.length > 0 && (
          <div className="absolute z-30 bottom-[4.5rem] left-3 right-3 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 shadow-lg max-h-36 overflow-y-auto text-xs">
            {mentionPick.map(m => (
              <button
                key={m.user_id}
                type="button"
                className="block w-full text-left px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                onMouseDown={e => e.preventDefault()}
                onClick={() => insertMention(m)}
              >
                {m.email}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={taRef}
          className="w-full min-h-[72px] rounded-lg border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-xs bg-white dark:bg-neutral-950 disabled:opacity-50"
          placeholder="Escribe un mensaje… (@ mencionar). Enter envía, Shift+Enter nueva línea."
          value={msgBody}
          disabled={!loggedIn || !userId}
          onSelect={e => updateMentionUi(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
          onChange={e => onMsgChange(e.target.value)}
          onKeyDown={e => {
            if (e.key !== 'Enter' || e.shiftKey) return
            if (e.nativeEvent.isComposing) return
            e.preventDefault()
            if (mentionOpen && mentionPick.length > 0) {
              insertMention(mentionPick[0])
              return
            }
            void sendMsg()
          }}
        />
        <button
          type="button"
          className="self-start px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs disabled:opacity-40"
          disabled={!loggedIn || !userId}
          onClick={() => void sendMsg()}
        >
          Enviar
        </button>
      </div>

      <div className={panelClass}>
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <ListTodo size={16} className="text-indigo-500" />
          Tareas
        </h2>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <input
              className="flex-1 min-w-[120px] rounded-lg border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-xs bg-white dark:bg-neutral-950 disabled:opacity-50"
              placeholder="Nueva tarea…"
              value={taskTitle}
              disabled={!loggedIn || !userId}
              onChange={e => setTaskTitle(e.target.value)}
            />
            <select
              className="rounded-lg border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-xs bg-white dark:bg-neutral-950 disabled:opacity-50"
              value={taskAssignTo}
              disabled={!loggedIn || !userId || members.length === 0}
              onChange={e => setTaskAssignTo(e.target.value)}
            >
              <option value="">Asignar…</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.email}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="px-2 py-1.5 rounded-lg bg-indigo-600 text-white text-xs disabled:opacity-40"
              disabled={!loggedIn || !userId}
              onClick={() => void addTask()}
            >
              Añadir
            </button>
          </div>
        </div>
        <ul className="flex flex-col gap-2 max-h-[260px] overflow-y-auto text-sm">
          {tasks.map(t => (
            <li key={t.id} className="flex flex-col gap-1 rounded-lg border border-neutral-100 dark:border-neutral-800 p-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={t.done}
                  disabled={!loggedIn}
                  onChange={e => void toggleTask(t.id, e.target.checked)}
                  className="mt-1"
                />
                <span className={cn('flex-1', t.done ? 'line-through text-neutral-400' : '')}>{t.title}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <label className="text-[10px] text-neutral-500 uppercase tracking-wide">Asignada a</label>
                <select
                  className="text-xs rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 py-0.5 pl-1 pr-6 disabled:opacity-50"
                  value={t.assigned_to ?? ''}
                  disabled={!loggedIn || !userId}
                  onChange={e => void assignTask(t.id, e.target.value)}
                >
                  <option value="">—</option>
                  {members.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.email}
                    </option>
                  ))}
                </select>
                {t.assigned_to && memberById.get(t.assigned_to) && (
                  <span className="text-[10px] text-neutral-400">{memberById.get(t.assigned_to)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
