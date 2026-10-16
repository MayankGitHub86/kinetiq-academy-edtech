import {
  Table, Column, Model, DataType, Default, AllowNull,
  ForeignKey, BelongsTo
} from 'sequelize-typescript';
import { User } from './User';

@Table({ tableName: 'user_profiles', paranoid: true })
export class Profile extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare firstName: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare lastName: string;

  @Column(DataType.STRING)
  declare displayName: string;

  @Column(DataType.STRING)
  declare avatarUrl: string;

  @Column(DataType.TEXT)
  declare bio: string;

  @Column(DataType.STRING)
  declare timezone: string;

  @Column(DataType.STRING)
  declare language: string;

  @Column(DataType.STRING)
  declare country: string;

  @Column(DataType.DATEONLY)
  declare dateOfBirth: Date;
}
