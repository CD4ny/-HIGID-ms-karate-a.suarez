import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma.service';
import { CreateCompetitiveActivityDto } from './dto/create-competitive-activity.dto';
import { UpdateCompetitiveActivityDto } from './dto/update-competitive-activity.dto';

@Injectable()
export class CompetitiveActivityService {
  constructor(private prisma: PrismaService) {}

  async create(createCompetitiveActivityDto: CreateCompetitiveActivityDto) {
    const { desc, endDate, startDate, type, karatecasIds } =
      createCompetitiveActivityDto;

    const { id: compActivityId } = await this.prisma.competitiveActivity.create(
      {
        data: {
          desc,
          endDate,
          startDate,
          type,
        },
      },
    );

    await this.prisma.competitiveActivityKarateca_Kumite.createMany({
      data: karatecasIds.map((karatecaId) => ({
        activityId: compActivityId,
        karatecaId,
      })),
    });
  }

  async findAll() {
    return await this.prisma.competitiveActivity.findMany({
      where: { deleted: false },
    });
  }

  async findOne(id: number) {
    const res = await this.prisma.competitiveActivity.findUnique({
      where: { id, deleted: false },
    });

    if (res) {
      const karatecasIds =
        await this.prisma.competitiveActivityKarateca_Kumite.findMany({
          where: { activityId: res.id, deleted: false },
          select: { karatecaId: true },
        });

      return {
        ...res,
        karatecasIds: karatecasIds.map(({ karatecaId }) => karatecaId),
      };
    } else return res;
  }

  async findKaratecas(id: number) {
    const karatecasIds =
      await this.prisma.competitiveActivityKarateca_Kumite.findMany({
        where: { activityId: id },
        select: { karatecaId: true },
      });

    // Here the deleted field is not checked because it needs to return the karatecas even if they are deleted
    const karatecas = await this.prisma.karateca.findMany({
      where: { id: { in: karatecasIds.map(({ karatecaId }) => karatecaId) } },
    });

    return karatecas;
  }

  async update(
    id: number,
    updateCompetitiveActivityDto: UpdateCompetitiveActivityDto,
  ) {
    const { desc, endDate, startDate, type, karatecasIds } =
      updateCompetitiveActivityDto;

    return await this.prisma.$transaction(async (prisma) => {
      const res = await prisma.competitiveActivity.update({
        where: { id, deleted: false },
        data: {
          desc,
          endDate,
          startDate,
          type,
        },
      });

      if (res) {
        await prisma.competitiveActivityKarateca_Kumite.updateMany({
          where: { karatecaId: { notIn: karatecasIds }, activityId: id },
          data: { deleted: true },
        });

        const existingKaratecasIds =
          await prisma.competitiveActivityKarateca_Kumite.findMany({
            where: { activityId: id, deleted: false },
            select: { karatecaId: true },
          });

        const existingKaratecasIdsSet = new Set(
          existingKaratecasIds.map(({ karatecaId }) => karatecaId),
        );
        const newKaratecasIds = karatecasIds
          .filter((karatecaId) => !existingKaratecasIdsSet.has(karatecaId))
          .map((karatecaId) => ({ activityId: id, karatecaId }));

        if (newKaratecasIds.length > 0) {
          await prisma.competitiveActivityKarateca_Kumite.createMany({
            data: newKaratecasIds,
          });
        }
      }

      return res;
    });
  }

  async remove(ids: number[]) {
    const res = await this.prisma.competitiveActivity.updateMany({
      where: { id: { in: ids } },
      data: { deleted: true },
    });

    if (res?.count > 0) {
      await this.prisma.competitiveActivityKarateca_Kumite.updateMany({
        where: { activityId: { in: ids } },
        data: { deleted: true },
      });
    }

    return res;
  }
}
