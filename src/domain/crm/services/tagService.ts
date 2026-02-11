import type { TagInsert, TagUpdate } from "@/domain/crm/dtos/tag";
import { tagRepository } from "@/data/crm/tagRepository";
import { tagSchema } from "@/domain/crm/validation/tagSchema";

export const tagService = {
  async list(companyId: string) {
    return tagRepository.list(companyId);
  },

  async create(values: TagInsert) {
    tagSchema.parse({
      name: values.name,
      color: values.color ?? "",
    });
    return tagRepository.create(values);
  },

  async update(id: string, values: TagUpdate) {
    return tagRepository.update(id, values);
  },

  async remove(id: string) {
    return tagRepository.remove(id);
  },
};
