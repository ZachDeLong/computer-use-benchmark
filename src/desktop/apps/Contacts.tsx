import { useStore } from '../store';
import type { ContactField } from '../../core/types';

const FIELD_LABEL: Record<ContactField, string> = { name: 'Name', email: 'Email', phone: 'Phone' };

export function ContactsApp() {
  const contacts = useStore((s) => s.desktop.contacts);
  const labels = useStore((s) => s.desktop.labels);
  const select = useStore((s) => s.contactsSelect);
  const newContact = useStore((s) => s.contactsNew);
  const setField = useStore((s) => s.contactsSetField);
  const save = useStore((s) => s.contactsSave);
  const cancel = useStore((s) => s.contactsCancel);
  const selected = contacts.list.find((c) => c.id === contacts.selectedId) ?? null;

  return (
    <div className="app contacts">
      <div className="app-toolbar">
        <button className="btn btn-primary" data-testid="contacts-new" onClick={newContact}>
          {labels.contactsNew}
        </button>
      </div>
      <div className="app-split">
        <ul className="list" data-testid="contacts-list">
          {contacts.list.map((c) => (
            <li
              key={c.id}
              className={`list-item ${c.id === contacts.selectedId && !contacts.draft ? 'is-active' : ''}`}
              data-testid={`contact-${c.id}`}
              onClick={() => select(c.id)}
            >
              {c.name}
            </li>
          ))}
        </ul>
        <div className="pane">
          {contacts.draft ? (
            <div className="form" data-testid="contacts-form">
              <div className="pane-title">New contact</div>
              {contacts.fieldOrder.map((f) => (
                <label key={f} className="field">
                  <span>{FIELD_LABEL[f]}</span>
                  <input data-testid={`contacts-field-${f}`} value={contacts.draft![f]} onChange={(e) => setField(f, e.target.value)} />
                </label>
              ))}
              <div className="row gap">
                <button className="btn btn-primary" data-testid="contacts-save" onClick={save}>
                  {labels.contactsSave}
                </button>
                <button className="btn" data-testid="contacts-cancel" onClick={cancel}>
                  Cancel
                </button>
              </div>
            </div>
          ) : selected ? (
            <div className="detail" data-testid="contacts-detail">
              <div className="pane-title">{selected.name}</div>
              <div className="detail-row">
                <span>Email</span>
                <span data-testid="detail-email">{selected.email}</span>
              </div>
              <div className="detail-row">
                <span>Phone</span>
                <span data-testid="detail-phone">{selected.phone}</span>
              </div>
            </div>
          ) : (
            <div className="muted pane-empty">Select a contact</div>
          )}
        </div>
      </div>
    </div>
  );
}
