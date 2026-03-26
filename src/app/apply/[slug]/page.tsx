import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ApplySlugRedirect({ params }: Props) {
  const { slug } = await params;
  redirect(`/vacature/${slug}`);
}
