import { useEffect, useMemo, useRef, useState } from 'react';
import { parseDateInput, toInputDate } from '../../utils/date';
import { SUBACQUIRERS, getSubacquirerById } from '../../constants/subacquirers';

const DEFAULT_START_DATE = '2026-02-25';
const DEFAULT_END_DATE = '2026-03-31';
const DEFAULT_CUSTOMER_HEADER = '';

const normalizeCustomerInput = (value) => {
  const input = String(value ?? '').trim();
  if (!input) return '';
  const directId = input.match(/^(\d+)$/);
  if (directId) return String(Number(directId[1]));
  const idFromLabel = input.match(/^(\d+)\s*-\s*/);
  if (idFromLabel) return String(Number(idFromLabel[1]));
  return '';
};

const subLabel = (sub) => `${sub.id} - ${sub.name}`;

function DateRangeFilter({ range, onApply, onCancel, disabled, loading }) {
  const [startDateInput, setStartDateInput] = useState(
    range?.startDate ? toInputDate(range.startDate) : DEFAULT_START_DATE,
  );
  const [endDateInput, setEndDateInput] = useState(
    range?.endDate ? toInputDate(range.endDate) : DEFAULT_END_DATE,
  );
  const [customerHeaderInput, setCustomerHeaderInput] = useState(
    range?.customerHeader
      ? `${range.customerHeader} - ${getSubacquirerById(range.customerHeader)?.name || ''}`.trim()
      : DEFAULT_CUSTOMER_HEADER,
  );
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(
    Array.isArray(range?.batchCustomerIds)
      ? range.batchCustomerIds.map((id) => String(Number(id))).filter(Boolean)
      : range?.customerHeader
      ? [String(Number(range.customerHeader))]
      : [],
  );
  const [showCustomerOptions, setShowCustomerOptions] = useState(false);
  const [customerError, setCustomerError] = useState('');
  const customerPickerRef = useRef(null);

  const isInvalid = useMemo(() => startDateInput > endDateInput, [startDateInput, endDateInput]);
  const filteredSubacquirers = useMemo(() => {
    const query = customerHeaderInput.trim().toLowerCase();
    if (!query) return SUBACQUIRERS;

    return SUBACQUIRERS.filter((sub) => {
      const label = subLabel(sub).toLowerCase();
      return label.includes(query) || String(sub.id).includes(query);
    });
  }, [customerHeaderInput]);

  useEffect(() => {
    if (!range) {
      return;
    }
    setStartDateInput(range.startDate ? toInputDate(range.startDate) : '');
    setEndDateInput(range.endDate ? toInputDate(range.endDate) : '');
    setCustomerHeaderInput(
      range.customerHeader
        ? `${range.customerHeader} - ${getSubacquirerById(range.customerHeader)?.name || ''}`.trim()
        : DEFAULT_CUSTOMER_HEADER,
    );
    setSelectedCustomerIds(
      Array.isArray(range.batchCustomerIds)
        ? range.batchCustomerIds.map((id) => String(Number(id))).filter(Boolean)
        : range.customerHeader
        ? [String(Number(range.customerHeader))]
        : [],
    );
    setCustomerError('');
  }, [range]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!customerPickerRef.current) {
        return;
      }

      if (!customerPickerRef.current.contains(event.target)) {
        setShowCustomerOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleCustomerId = (id) => {
    const idText = String(Number(id));
    setSelectedCustomerIds((current) => {
      if (current.includes(idText)) {
        return current.filter((item) => item !== idText);
      }
      return [...current, idText];
    });
    setCustomerError('');
  };

  const markAllFiltered = () => {
    setSelectedCustomerIds(filteredSubacquirers.map((sub) => String(sub.id)));
    setCustomerError('');
  };

  const clearSelected = () => {
    setSelectedCustomerIds([]);
    setCustomerError('');
  };

  const applyFilter = (event) => {
    event.preventDefault();

    if (isInvalid) {
      return;
    }

    // Impedir consulta sem customer selecionado
    if (selectedCustomerIds.length === 0 && !normalizeCustomerInput(customerHeaderInput)) {
      setCustomerError('Selecione um customer válido da lista ou marque os IDs desejados.');
      return;
    }

    if (selectedCustomerIds.length > 0) {
      const uniqueSorted = Array.from(new Set(selectedCustomerIds.map((id) => String(Number(id))))).sort(
        (a, b) => Number(a) - Number(b),
      );
      const firstSelectedId = uniqueSorted[0] || '';

      onApply({
        startDate: parseDateInput(startDateInput),
        endDate: parseDateInput(endDateInput),
        codigoUnidadeNegocios: '0',
        customerHeader: firstSelectedId,
        batchCustomerIds: uniqueSorted,
      });
      setShowCustomerOptions(false);
      return;
    }

    const customerId = normalizeCustomerInput(customerHeaderInput);
    setCustomerError('');
    setShowCustomerOptions(false);

    onApply({
      startDate: parseDateInput(startDateInput),
      endDate: parseDateInput(endDateInput),
      codigoUnidadeNegocios: '0',
      customerHeader: customerId,
      batchCustomerIds: [customerId],
    });
  };

  return (
    <form className="filter-card fade-up" onSubmit={applyFilter}>
      <h2>Filtro de período</h2>

      <div className="filter-grid">
        <label>
          Data inicial
          <input
            type="date"
            value={startDateInput}
            onChange={(event) => setStartDateInput(event.target.value)}
            max={endDateInput}
            required
            disabled={disabled}
          />
        </label>

        <label>
          Data final
          <input
            type="date"
            value={endDateInput}
            onChange={(event) => setEndDateInput(event.target.value)}
            min={startDateInput}
            required
            disabled={disabled}
          />
        </label>

        <label className="customer-picker" ref={customerPickerRef}>
          <span style={{ fontWeight: 600 }}>Selecione Customers</span>
          <div className="customer-picker__control" onClick={() => setShowCustomerOptions(true)}>
            <input
              type="text"
              value={customerHeaderInput}
              onFocus={() => setShowCustomerOptions(true)}
              onClick={() => setShowCustomerOptions(true)}
              onChange={(event) => {
                setCustomerHeaderInput(event.target.value);
                setCustomerError('');
                setShowCustomerOptions(true);
              }}
              placeholder="Buscar por nome ou ID..."
              disabled={disabled}
              style={{ width: '100%' }}
            />
          </div>

          {/* Tags selecionadas */}
          {selectedCustomerIds.length > 0 && (
            <div className="selected-tags">
              {selectedCustomerIds.map((id) => {
                const sub = getSubacquirerById(id);
                return (
                  <span key={id} className="selected-tag">
                    {id}{sub ? ` - ${sub.name}` : ''}
                    <button
                      type="button"
                      aria-label="Remover"
                      className="selected-tag__remove"
                      onClick={() => toggleCustomerId(id)}
                    >×</button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Dropdown */}
          {showCustomerOptions && !disabled && (
            <div
              className="customer-picker__menu"
              onMouseDown={(event) => event.preventDefault()}
            >
              <div className="customer-picker__actions">
                <button type="button" className="btn btn--secondary" onClick={markAllFiltered}>
                  Selecionar todos
                </button>
                <button type="button" className="btn btn--secondary" onClick={clearSelected}>
                  Limpar
                </button>
                <button type="button" className="btn btn--secondary" onClick={() => setShowCustomerOptions(false)}>
                  Fechar
                </button>
              </div>
              {filteredSubacquirers.length > 0 ? (
                filteredSubacquirers.map((sub) => {
                  const checked = selectedCustomerIds.includes(String(sub.id));
                  return (
                    <label
                      key={sub.id}
                      className={`customer-picker__option ${checked ? 'customer-picker__option--selected' : ''}`}
                    >
                      <input
                        className="customer-picker__check"
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCustomerId(sub.id)}
                      />
                      <span className="customer-picker__id">{sub.id}</span>
                      <span className="customer-picker__name">{sub.name}</span>
                    </label>
                  );
                })
              ) : (
                <p className="customer-picker__empty">Nenhuma sub encontrada.</p>
              )}
            </div>
          )}
        </label>

        <div className="filter-actions">
          <button type="submit" className="btn" disabled={disabled || isInvalid}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                Consultando...
              </span>
            ) : 'Aplicar filtro'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={!loading}>
            Cancelar
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
        <small className="source-tag">
          Marque quantos IDs quiser. O motor consulta um por vez e monta o relatório.
        </small>
        {selectedCustomerIds.length > 0 && (
          <small className="source-tag" style={{
            background: 'var(--accent-soft)',
            padding: '3px 12px',
            borderRadius: '999px',
            fontWeight: 700,
            color: 'var(--accent)',
            border: '1px solid var(--tag-border)',
          }}>
            {selectedCustomerIds.length} IDs selecionados
          </small>
        )}
      </div>

      {customerError && <small className="filter-error">{customerError}</small>}
      {isInvalid && <small className="filter-error">A data inicial não pode ser maior que a data final.</small>}
    </form>
  );
}

export default DateRangeFilter;
