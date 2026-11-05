import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useProductLookup, useSaveStockControl } from '../../hooks/useStockControls';
import { ApiError } from '../../services/httpClient';
import { OPERATIONAL_BASES, type StockControl } from '../../services/types';
import { int } from '../../utils/format';
import { Dialog } from '../ui/Dialog';
import {
  EMPTY_FORM, StockControlFormSchema, toFormValues, toInput, type StockControlFormValues,
} from './stockControlForm';

interface StockControlDialogProps {
  /** null = item novo */
  item: StockControl | null;
  /** situações e compradores já usados no cadastro, sugeridos nos campos */
  categories: string[];
  buyers: string[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

/** Criar ou editar um item do cadastro de controle de estoque. */
export function StockControlDialog({ item, categories, buyers, onClose, onSaved }: StockControlDialogProps) {
  const save = useSaveStockControl();
  const {
    register, handleSubmit, watch, setValue, setError, formState: { errors, isSubmitting },
  } = useForm<StockControlFormValues>({
    resolver: zodResolver(StockControlFormSchema),
    defaultValues: item ? toFormValues(item) : EMPTY_FORM,
    mode: 'onTouched',
  });

  const codeText = useDebouncedValue(watch('code').trim());
  const code = /^\d{1,8}$/.test(codeText) && Number(codeText) > 0 ? Number(codeText) : null;
  const product = useProductLookup(code);
  const itemText = watch('item');
  const busy = isSubmitting || save.isPending;

  const submit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id: item?.id ?? null, input: toInput(values) });
      onSaved(item ? `Código ${saved.code} atualizado.` : `Código ${saved.code} cadastrado na ${saved.baseName}.`);
    } catch (err) {
      const apiError = err instanceof ApiError ? err : null;
      if (apiError?.code === 'STOCK_CONTROL_ALREADY_EXISTS') {
        setError('code', { message: apiError.message }, { shouldFocus: true });
        return;
      }
      setError('root', { message: apiError?.message ?? 'Não foi possível salvar. Tente novamente.' });
    }
  });

  const fieldError = (name: keyof StockControlFormValues) => {
    const message = errors[name]?.message;
    return message ? <span className="campo-erro" role="alert">{message}</span> : null;
  };

  return (
    <Dialog
      title={item ? `Editar código ${item.code}` : 'Novo item no controle de estoque'}
      description="Mínimo e alerta valem por base. A alteração aparece na hora nas telas de alerta de estoque."
      onClose={onClose}
      busy={busy}
    >
      <form className="form-cadastro" onSubmit={submit} noValidate>
        <div className="campos">
          <label className="campo">
            <span>Código *</span>
            <input {...register('code')} inputMode="numeric" autoComplete="off" data-autofocus aria-invalid={!!errors.code} />
            {fieldError('code')}
            {code !== null && (
              <small className="campo-ajuda">
                {product.isFetching && !product.data ? 'consultando o Voalle…'
                  : product.data ? (
                    <>
                      Voalle: <b>{product.data.description}</b>
                      {product.data.bases.length > 0 && ` · saldo em ${product.data.bases.map((b) => `${b.baseName.replace('BASE OPERACIONAL - ', '')} (${int(b.units)})`).join(', ')}`}
                      {!itemText.trim() && (
                        <button type="button" className="link" onClick={() => setValue('item', product.data?.description ?? '', { shouldDirty: true })}>
                          usar como item
                        </button>
                      )}
                    </>
                  )
                    : product.data === null ? 'Este código não aparece no saldo do Voalle — confira antes de salvar.'
                      : null}
              </small>
            )}
          </label>

          <label className="campo">
            <span>Base de origem *</span>
            <select {...register('baseName')} aria-invalid={!!errors.baseName}>
              <option value="">Escolha…</option>
              {OPERATIONAL_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            {fieldError('baseName')}
          </label>

          <label className="campo largo">
            <span>Item</span>
            <input {...register('item')} autoComplete="off" placeholder="Descrição do item (opcional)" aria-invalid={!!errors.item} />
            {fieldError('item')}
          </label>

          <label className="campo">
            <span>Situação *</span>
            <input {...register('category')} list="situacoes-cadastradas" autoComplete="off" aria-invalid={!!errors.category} />
            <datalist id="situacoes-cadastradas">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
            {fieldError('category')}
          </label>

          <label className="campo">
            <span>Comprador responsável</span>
            <input {...register('buyer')} list="compradores-cadastrados" autoComplete="off" aria-invalid={!!errors.buyer} />
            <datalist id="compradores-cadastrados">
              {buyers.map((b) => <option key={b} value={b} />)}
            </datalist>
            {fieldError('buyer')}
          </label>

          <label className="campo">
            <span>Estoque mínimo *</span>
            <input {...register('minimumLevel')} inputMode="numeric" autoComplete="off" aria-invalid={!!errors.minimumLevel} />
            {fieldError('minimumLevel')}
            <small className="campo-ajuda">saldo até aqui = <b>MÍNIMO</b></small>
          </label>

          <label className="campo">
            <span>Alerta de estoque *</span>
            <input {...register('alertLevel')} inputMode="numeric" autoComplete="off" aria-invalid={!!errors.alertLevel} />
            {fieldError('alertLevel')}
            <small className="campo-ajuda">acima do mínimo e até aqui = <b>ALERTA</b></small>
          </label>

          <label className="campo">
            <span>Lead time (dias)</span>
            <input {...register('leadTimeDays')} inputMode="numeric" autoComplete="off" aria-invalid={!!errors.leadTimeDays} />
            {fieldError('leadTimeDays')}
          </label>

          <label className="campo">
            <span>Processo externo</span>
            <input {...register('externalProcess')} autoComplete="off" placeholder="Ex.: 2 UND PARA CONSERTO EXTERNO" aria-invalid={!!errors.externalProcess} />
            {fieldError('externalProcess')}
          </label>
        </div>

        {errors.root?.message && <div className="banner error" role="alert">{errors.root.message}</div>}

        <footer>
          {item && <span className="quem-alterou">Última alteração por {item.updatedBy}</span>}
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn primario" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        </footer>
      </form>
    </Dialog>
  );
}
