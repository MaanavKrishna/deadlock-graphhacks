import { useState, type FormEvent } from 'react';
import { LoaderCircle, MessageSquareText } from 'lucide-react';
import type { Answer, Deal, Snapshot, Source } from '../../shared/types';
import { api } from '../api';

const examples = [
  'What breaks if Motionhaus leaves?',
  'Who can supply video, and how much capacity is free?',
  'Why did the last agreement end the way it did?',
  'Which agency does every exchange loop depend on?',
];

export default function AskView({
  state,
  onOpenDeal,
  onOpenAgency,
}: {
  state: Snapshot;
  onOpenDeal: (d: Deal) => void;
  onOpenAgency: (id: string) => void;
}) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Answer[]>([]);
  async function ask(text: string, e?: FormEvent) {
    e?.preventDefault();
    if (text.trim().length < 3) return;
    setBusy(true);
    setError('');
    try {
      const answer = await api<Answer>('/ask', { question: text.trim() });
      setAnswers((a) => [answer, ...a].slice(0, 10));
      setQuestion('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function open(source: Source) {
    if (source.type === 'deal') {
      const deal = state.deals.find((d) => d.id === source.id);
      if (deal) onOpenDeal(deal);
    }
    if (source.type === 'agency') onOpenAgency(source.id);
  }
  return (
    <section className="ask-view">
      <form className="ask-form" onSubmit={(e) => ask(question, e)}>
        <label htmlFor="ask-input">Ask the network</label>
        <div className="ask-row">
          <input
            id="ask-input"
            value={question}
            maxLength={500}
            placeholder="e.g. What breaks if Studio North pauses?"
            onChange={(e) => setQuestion(e.target.value)}
            disabled={busy || !state.modelConfigured}
          />
          <button className="primary" disabled={busy || !state.modelConfigured}>
            {busy ? <LoaderCircle size={16} className="spin" /> : <MessageSquareText size={16} />}
            Ask
          </button>
        </div>
        {!state.modelConfigured && (
          <p className="ask-note">
            Configure a model on the server to ask questions. Every answer is built from graph tool
            calls and cites the nodes it used.
          </p>
        )}
        <div className="ask-examples">
          {examples.map((x) => (
            <button
              type="button"
              key={x}
              className="secondary"
              disabled={busy || !state.modelConfigured}
              onClick={() => ask(x)}
            >
              {x}
            </button>
          ))}
        </div>
      </form>
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      <div className="ask-answers" aria-live="polite">
        {answers.map((a, i) => (
          <article className="ask-answer" key={i}>
            <h3>{a.question}</h3>
            <p>{a.answer}</p>
            {a.sources.length > 0 && (
              <div className="ask-sources">
                <span>Sources</span>
                {a.sources.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`source-chip ${s.type}`}
                    onClick={() => open(s)}
                    disabled={s.type !== 'deal' && s.type !== 'agency'}
                    title={s.id}
                  >
                    <b>{s.type}</b> {s.label}
                  </button>
                ))}
              </div>
            )}
            <details>
              <summary>
                {a.trace.length} graph tool call{a.trace.length === 1 ? '' : 's'}
                {a.model ? ` · ${a.model}` : ''}
              </summary>
              <ol>
                {a.trace.map((t, j) => (
                  <li key={j}>
                    <code>
                      {t.tool}({JSON.stringify(t.args)})
                    </code>{' '}
                    → {t.resultCount} node{t.resultCount === 1 ? '' : 's'}
                  </li>
                ))}
              </ol>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
