import {
  Table, Column, Model, DataType, Default, AllowNull,
  ForeignKey, BelongsTo
} from 'sequelize-typescript';
import { User } from './User';

@Table({ tableName: 'onboarding_data', paranoid: true })
export class Onboarding extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @Column(DataType.ARRAY(DataType.STRING))
  declare selectedInterests?: string[];

  @Column(DataType.STRING)
  declare experienceLevel?: string;

  @Column(DataType.ARRAY(DataType.STRING))
  declare learningGoals?: string[];

  @Column(DataType.INTEGER)
  declare dailyLearningTargetMinutes?: number;

  @Column(DataType.STRING)
  declare preferredLearningFormat?: string;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare completedStatus: boolean;
}
