export type ProfileChangeRequest = {
  comment: string;
  fields: string[];
};

export function parseProfileChangeRequest(value: string | null | undefined): ProfileChangeRequest | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<ProfileChangeRequest>;
    const comment = typeof parsed.comment === "string" ? parsed.comment.trim() : "";
    const fields = Array.isArray(parsed.fields)
      ? parsed.fields.filter((field): field is string => typeof field === "string" && field.trim().length > 0)
      : [];

    if (!comment && fields.length === 0) return null;

    return {
      comment,
      fields,
    };
  } catch {
    return {
      comment: value,
      fields: [],
    };
  }
}
