import type { PipelineInsert, PipelineUpdate } from "@/domain/crm/dtos/pipeline";
import { pipelineRepository } from "@/data/crm/pipelineRepository";
import { pipelineSchema } from "@/domain/crm/validation/pipelineSchema";

export const pipelineService = {
  async list(companyId: string) {
    return pipelineRepository.list(companyId);
  },

  async create(values: PipelineInsert) {
    pipelineSchema.parse({
      name: values.name,
      stages: values.stages ?? [],
    });
    return pipelineRepository.create(values);
  },

  async update(id: string, values: PipelineUpdate) {
    return pipelineRepository.update(id, values);
  },

  async remove(id: string) {
    return pipelineRepository.remove(id);
  },
};
