import { useEffect, useState } from 'react';
import { db } from '../lib/supabaseClient';
import HireProviderTask from './HireProviderTask';
import ScheduleProviderTask from './ScheduleProviderTask';
import { PROVIDER_TASK_CONFIG } from '../lib/providerTaskConfig';
import '../styles/stage-task-module.css';

// Add an entry here whenever a new task gets its own mini-module instead of
// a plain checkbox. Anything not listed falls back to the default checkbox.
const CUSTOM_RENDERERS = {
  hire: HireProviderTask,
  schedule: ScheduleProviderTask,
};

export default function StageTaskModule({
  transactionId,
  stage,
  buyerId,
  agentId,
  sellerId,
  viewerId,
  onStageAdvance,
}) {
  const [tasks, setTasks] = useState([]);
  const [completions, setCompletions] = useState({}); // task_key -> completed_by
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingKey, setPendingKey] = useState(null);
  const [justAdvanced, setJustAdvanced] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [templatesRes, completionsRes] = await Promise.all([
        db
          .schema('marketplace')
          .from('stage_task_templates')
          .select('task_key, label, description, owner_role, sort_order')
          .eq('stage', stage)
          .order('sort_order'),
        db
          .schema('marketplace')
          .from('transaction_task_completions')
          .select('task_key, completed_by')
          .eq('transaction_id', transactionId)
          .eq('stage', stage),
      ]);

      if (cancelled) return;

      if (templatesRes.error) {
        setError(templatesRes.error.message);
        setLoading(false);
        return;
      }

      const completedMap = {};
      (completionsRes.data || []).forEach((c) => {
        completedMap[c.task_key] = c.completed_by;
      });

      setTasks(templatesRes.data || []);
      setCompletions(completedMap);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [transactionId, stage]);

  function canToggle(ownerRole) {
    if (ownerRole === 'both') return viewerId === buyerId || viewerId === agentId || viewerId === sellerId;
    if (ownerRole === 'buyer') return viewerId === buyerId;
    if (ownerRole === 'agent') return viewerId === agentId || viewerId === sellerId;
    return false;
  }

  function handleCustomTaskCompleted(taskKey, nextStage) {
    setCompletions((prev) => ({ ...prev, [taskKey]: viewerId }));
    if (nextStage && nextStage !== stage) {
      setJustAdvanced(true);
      onStageAdvance?.(nextStage);
    }
  }

  async function handleCheckboxToggle(taskKey, nextCompleted) {
    setPendingKey(taskKey);
    setError(null);

    setCompletions((prev) => {
      const next = { ...prev };
      if (nextCompleted) next[taskKey] = viewerId;
      else delete next[taskKey];
      return next;
    });

    const { data: nextStage, error: rpcError } = await db
      .schema('marketplace')
      .rpc('toggle_task_completion', {
        p_transaction_id: transactionId,
        p_task_key: taskKey,
        p_completed: nextCompleted,
      });

    setPendingKey(null);

    if (rpcError) {
      setError(rpcError.message);
      setCompletions((prev) => {
        const next = { ...prev };
        if (nextCompleted) delete next[taskKey];
        else next[taskKey] = viewerId;
        return next;
      });
      return;
    }

    if (nextStage && nextStage !== stage) {
      setJustAdvanced(true);
      onStageAdvance?.(nextStage);
    }
  }

  if (loading) {
    return <div className="stage-task-module stage-task-module-state">Loading tasks…</div>;
  }

  if (error) {
    return (
      <div className="stage-task-module stage-task-module-state stage-task-module-error">
        Couldn't load tasks: {error}
      </div>
    );
  }

  if (tasks.length === 0) {
    return null;
  }

  const doneCount = tasks.filter((t) => completions[t.task_key]).length;

  return (
    <div className="stage-task-module">
      <div className="stage-task-module-header">
        <span className="stage-task-module-progress">
          {doneCount} / {tasks.length} done
        </span>
      </div>

      <ul className="stage-task-module-list">
        {tasks.map((task) => {
          const isDone = Boolean(completions[task.task_key]);
          const editable = canToggle(task.owner_role) && !justAdvanced;
          const isPending = pendingKey === task.task_key;
          const customConfig = PROVIDER_TASK_CONFIG[task.task_key];
          const CustomRenderer = customConfig ? CUSTOM_RENDERERS[customConfig.mode] : null;

          return (
            <li
              key={task.task_key}
              className={`stage-task-module-item${isDone ? ' is-done' : ''}${
                !editable ? ' is-readonly' : ''
              }${CustomRenderer ? ' has-custom-module' : ''}`}
            >
              {CustomRenderer ? (
                <div className="stage-task-module-item-text stage-task-module-item-text-full">
                  <span className="stage-task-module-item-label">{task.label}</span>
                  {task.description && (
                    <span className="stage-task-module-item-description">{task.description}</span>
                  )}
                  <CustomRenderer
                    transactionId={transactionId}
                    task={task}
                    editable={editable}
                    onTaskCompleted={(nextStage) => handleCustomTaskCompleted(task.task_key, nextStage)}
                  />
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="stage-task-module-checkbox"
                    role="checkbox"
                    aria-checked={isDone}
                    disabled={!editable || isPending}
                    onClick={() => handleCheckboxToggle(task.task_key, !isDone)}
                  >
                    {isDone ? '✓' : ''}
                  </button>

                  <div className="stage-task-module-item-text">
                    <span className="stage-task-module-item-label">{task.label}</span>
                    {task.description && (
                      <span className="stage-task-module-item-description">{task.description}</span>
                    )}
                    {!editable && !isDone && (
                      <span className="stage-task-module-item-waiting">
                        Waiting on {task.owner_role === 'buyer' ? 'buyer' : 'agent/seller'}
                      </span>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {justAdvanced && (
        <p className="stage-task-module-advanced">Stage complete — moving to the next step…</p>
      )}
    </div>
  );
}