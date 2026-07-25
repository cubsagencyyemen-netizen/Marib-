import React, { useEffect, useState, useRef } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { format, isBefore, parseISO } from 'date-fns'

const STORAGE_KEY = 'marib_todos_v2'

type Todo = {
  id: string
  text: string
  completed: boolean
  due?: string | null
  createdAt: string
}

export default function App(){
  const [todos, setTodos] = useState<Todo[]>(() => loadTodos())
  const [text, setText] = useState('')
  const [filter, setFilter] = useState<'all'|'active'|'completed'>('all')
  const fileRef = useRef<HTMLInputElement|null>(null)

  useEffect(() => {
    saveTodos(todos)
  }, [todos])

  useEffect(() => {
    // request notification permission once
    if('Notification' in window && Notification.permission === 'default'){
      Notification.requestPermission().catch(()=>{})
    }
  }, [])

  useEffect(() => {
    // check for due items and notify if needed (simple check on load)
    todos.forEach(t => {
      if(t.due){
        const dueDate = parseISO(t.due)
        if(!t.completed && isBefore(dueDate, new Date())){
          showNotification('تذكير مهمة', `${t.text}‎ — انتهت المهلة`)
        }
      }
    })
  }, [])

  function addTodo(){
    const val = text.trim()
    if(!val) return
    const item: Todo = { id: String(Date.now()), text: val, completed: false, createdAt: new Date().toISOString(), due: null }
    setTodos(prev => [item, ...prev])
    setText('')
  }

  function toggle(id:string){
    setTodos(prev => prev.map(t => t.id === id ? {...t, completed: !t.completed} : t))
  }

  function updateText(id:string, newText:string){
    setTodos(prev => prev.map(t => t.id === id ? {...t, text: newText} : t))
  }

  function setDue(id:string, due:string|null){
    setTodos(prev => prev.map(t => t.id === id ? {...t, due} : t))
  }

  function remove(id:string){
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  function clearCompleted(){
    setTodos(prev => prev.filter(t => !t.completed))
  }

  function onDragEnd(result:any){
    if(!result.destination) return
    const src = result.source.index
    const dst = result.destination.index
    const copy = Array.from(todos)
    const [moved] = copy.splice(src,1)
    copy.splice(dst,0,moved)
    setTodos(copy)
  }

  function exportJson(){
    const dataStr = JSON.stringify(todos, null, 2)
    const blob = new Blob([dataStr], {type: 'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'marib-todos.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function importJson(e:React.ChangeEvent<HTMLInputElement>){
    const file = e.target.files && e.target.files[0]
    if(!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try{
        const data = JSON.parse(String(reader.result))
        if(Array.isArray(data)){
          // basic validation
          const parsed: Todo[] = data.map((d:any)=>({
            id: String(d.id || Date.now()+Math.random()),
            text: String(d.text || ''),
            completed: Boolean(d.completed),
            due: d.due || null,
            createdAt: d.createdAt || new Date().toISOString()
          }))
          setTodos(parsed)
        } else alert('ملف غير صالح')
      } catch(err){
        alert('حصل خطأ أثناء القراءة')
      }
    }
    reader.readAsText(file)
    e.currentTarget.value = ''
  }

  function showNotification(title:string, body:string){
    if('Notification' in window && Notification.permission === 'granted'){
      try{
        new Notification(title, { body })
      } catch(e){ /* ignore */ }
    }
  }

  const filtered = todos.filter(t => {
    if(filter === 'active') return !t.completed
    if(filter === 'completed') return t.completed
    return true
  })

  return (
    <div className="container" dir="rtl">
      <header>
        <h1>قائمة المهام</h1>
      </header>

      <section className="input-row">
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="أضف مهمة جديدة..." onKeyDown={e=>{ if(e.key === 'Enter') addTodo() }} />
        <button onClick={addTodo}>أضف</button>
      </section>

      <section className="controls">
        <div className="filters">
          <button onClick={()=>setFilter('all')} className={filter==='all'? 'active':''}>الكل</button>
          <button onClick={()=>setFilter('active')} className={filter==='active'? 'active':''}>قيد العمل</button>
          <button onClick={()=>setFilter('completed')} className={filter==='completed'? 'active':''}>مكتملة</button>
        </div>
        <div className="actions">
          <button onClick={exportJson}>تصدير JSON</button>
          <input ref={fileRef} type="file" accept="application/json" style={{display:'none'}} onChange={importJson} />
          <button onClick={()=>fileRef.current?.click()}>استيراد JSON</button>
          <button onClick={clearCompleted}>مسح المكتملة</button>
        </div>
      </section>

      <main>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="list">
            {(provided) => (
              <ul className="todo-list" {...provided.droppableProps} ref={provided.innerRef}>
                {filtered.length === 0 && <li className="empty">لا توجد مهام</li>}
                {filtered.map((t, idx) => (
                  <Draggable key={t.id} draggableId={t.id} index={idx}>
                    {(prov) => (
                      <li className={`todo-item ${t.completed? 'completed':''}`} ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}>
                        <input type="checkbox" checked={t.completed} onChange={()=>toggle(t.id)} />
                        <div className="content">
                          <EditableText text={t.text} onChange={(v)=>updateText(t.id, v)} />
                          <div className="meta">
                            <label>تاريخ الاستحقاق: </label>
                            <input type="date" value={t.due ? t.due.split('T')[0] : ''} onChange={(e)=>{
                              const v = e.target.value ? new Date(e.target.value).toISOString() : null
                              setDue(t.id, v)
                            }} />
                            {t.due && <span className="due">{format(parseISO(t.due),'yyyy-MM-dd')}</span>}
                          </div>
                        </div>
                        <div className="item-actions">
                          <button onClick={()=>remove(t.id)}>حذف</button>
                        </div>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      </main>

      <footer>
        <span>{todos.filter(t=>!t.completed).length} مهمة متبقية</span>
      </footer>
    </div>
  )
}

function EditableText({text, onChange}:{text:string,onChange:(v:string)=>void}){
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(text)
  const ref = useRef<HTMLInputElement|null>(null)

  useEffect(()=> setValue(text), [text])

  useEffect(()=>{ if(editing) ref.current?.focus() }, [editing])

  return (
    <div className="editable">
      {editing ? (
        <input ref={ref} value={value} onChange={e=>setValue(e.target.value)} onBlur={()=>{ setEditing(false); onChange(value.trim() || text) }} onKeyDown={e=>{ if(e.key === 'Enter'){ setEditing(false); onChange(value.trim() || text) } }} />
      ) : (
        <div className="text" onDoubleClick={()=>setEditing(true)}>{text}</div>
      )}
    </div>
  )
}

// Storage helpers
function loadTodos(): Todo[]{
  try{
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch(e){ return [] }
}

function saveTodos(todos:Todo[]){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(todos)) } catch(e){}
}
