import { z } from 'zod';
import { createJsonFileStore } from '../../common/storage/json-file.store.js';
import { USER_ROLES, type UserEntity } from './user.entity.js';

/** Cadastro de usuários: `users.json` no volume de dados (ver `createJsonFileStore`). */
const UserSchema = z.object({
  email: z.string(),
  name: z.string(),
  picture: z.string().nullable(),
  role: z.enum(USER_ROLES),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  lastLoginAt: z.string().nullable(),
  managementAccess: z.boolean().optional(),
});
const StoreSchema = z.object({ users: z.array(UserSchema) });

const store = createJsonFileStore<{ users: UserEntity[] }>({
  fileName: 'users.json',
  schema: StoreSchema,
  initial: () => ({ users: [] }),
  label: 'users',
  unreadableCode: 'USER_STORE_UNREADABLE',
  unreadableMessage: 'O cadastro de usuários não pôde ser lido.',
});

export const readUsers = (): UserEntity[] => store.read().users;
export const writeUsers = (users: UserEntity[]): void => {
  store.write({ users });
};
