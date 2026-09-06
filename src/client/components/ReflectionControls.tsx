import { REFLECTION_DEPTHS, REFLECTION_INTERESTS, type ReflectionPreferences } from '../../shared/schemas';
import { DEPTH_COPY, INTEREST_LABELS } from '../../shared/reflection';

export default function ReflectionControls({ value, onChange, disabled = false, compact = false }: {
  value: ReflectionPreferences; onChange: (value: ReflectionPreferences) => void; disabled?: boolean; compact?: boolean;
}) {
  return <fieldset className="reflection-controls" disabled={disabled}>
    <legend>How deeply would you like to explore?</legend>
    <div className="depth-options">
      {REFLECTION_DEPTHS.map((depth) => <button key={depth} type="button" className="btn-quiet"
        aria-pressed={value.depth === depth} onClick={() => onChange({ ...value, depth })}>
        {DEPTH_COPY[depth].label}
      </button>)}
    </div>
    <p className="composer-hint">{DEPTH_COPY[value.depth].description}</p>
    {!compact && <p className="depth-example">For example, after writing about work made easier by AI: “{DEPTH_COPY[value.depth].example}”</p>}
    <details>
      <summary>Optional interests and challenge</summary>
      <p className="composer-hint">Connections only when relevant to your writing. You can change these for any entry.</p>
      <div className="interest-options">
        {REFLECTION_INTERESTS.map((interest) => <label key={interest}>
          <input type="checkbox" checked={value.interests.includes(interest)} onChange={(e) => onChange({
            ...value, interests: e.target.checked ? [...value.interests, interest] : value.interests.filter((i) => i !== interest),
          })} /> {INTEREST_LABELS[interest]}
        </label>)}
      </div>
      <label><input type="checkbox" checked={value.challenge} onChange={(e) => onChange({ ...value, challenge: e.target.checked })} /> Invite respectful challenge to my assumptions</label>
    </details>
  </fieldset>;
}
