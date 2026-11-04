import cover1 from '@/assets/img/asset-cover/1.png'
import cover2 from '@/assets/img/asset-cover/2.png'
import cover3 from '@/assets/img/asset-cover/3.png'
import cover4 from '@/assets/img/asset-cover/4.png'

const coverMap: Record<number, string> = {
  1: cover1,
  2: cover2,
  3: cover3,
  4: cover4,
}

export const getAssetCoverByCategory = (categoryId?: number | string | null) => {
  const id = Number(categoryId || 1)
  return coverMap[id] || coverMap[1]
}
