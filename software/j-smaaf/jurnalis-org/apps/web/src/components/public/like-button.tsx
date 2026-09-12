'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLikeContent } from '@/hooks/use-content'
import { useUser } from '@/hooks/use-user'
import { toast } from 'sonner'

export function LikeButton({ contentId, initialLikes }: { contentId: string; initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes)
  const [liked, setLiked] = useState(false)
  const like = useLikeContent()
  const { data: user } = useUser()

  function handleLike() {
    if (!user) {
      toast.info('Login dulu untuk menyukai konten')
      return
    }
    like.mutate(contentId, {
      onSuccess: (res) => {
        setLiked(res.liked)
        setLikes(res.likes)
      },
    })
  }

  return (
    <Button variant={liked ? 'default' : 'outline'} size="sm" onClick={handleLike} disabled={like.isPending}>
      <Heart className={`mr-2 h-4 w-4 ${liked ? 'fill-current' : ''}`} />
      {likes}
    </Button>
  )
}
