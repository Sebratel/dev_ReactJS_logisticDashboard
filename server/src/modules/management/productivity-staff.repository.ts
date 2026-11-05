import { z } from 'zod';
import { createJsonFileStore } from '../../common/storage/json-file.store.js';
import { DEFAULT_PRODUCTIVITY_STAFF } from '../../model/business-rules.js';

/**
 * Quem aparece na "PRODUTIVIDADE ALMOX" (seção Gerencial): `productivity-staff.json`
 * no volume de dados. Sem o arquivo, vale a lista do Power BI — ele só é
 * gravado na primeira alteração pela tela de Administração.
 */
export interface ProductivityStaffEntity {
  names: string[];
  /** quando e por quem a lista foi alterada (null = a lista inicial, do Power BI) */
  updatedAt: string | null;
  updatedBy: string | null;
}

const StoreSchema = z.object({
  names: z.array(z.string()),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
});

const store = createJsonFileStore<ProductivityStaffEntity>({
  fileName: 'productivity-staff.json',
  schema: StoreSchema,
  initial: () => ({ names: [...DEFAULT_PRODUCTIVITY_STAFF], updatedAt: null, updatedBy: null }),
  label: 'productivity-staff',
  unreadableCode: 'PRODUCTIVITY_STAFF_STORE_UNREADABLE',
  unreadableMessage: 'A lista da produtividade do almoxarifado não pôde ser lida.',
});

export const readProductivityStaff = (): ProductivityStaffEntity => store.read();
export const writeProductivityStaff = (value: ProductivityStaffEntity): void => {
  store.write(value);
};
