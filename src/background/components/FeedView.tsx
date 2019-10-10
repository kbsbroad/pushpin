import React, { useEffect, useState } from 'react'
import { Feed } from 'hypermerge/dist/hypercore'
import { useImmer } from 'use-immer'
import { toDiscoveryId } from 'hypermerge/dist/Misc'
import { FeedId } from 'hypermerge/dist/FeedStore'
import { useRepo } from '../BackgroundHooks'
import Info from './Info'

interface Props {
  feedId: FeedId
}

export default function FeedView({ feedId }: Props) {
  const feed = useFeed(feedId)
  const info = useFeedInfo(feedId)

  return (
    <div>
      <Info
        log={feed}
        feedId={feedId}
        discoveryId={toDiscoveryId(feedId)}
        isWritable={info.writable}
        blocks={`${info.downloaded} / ${info.total}`}
      />

      <div
        style={{
          marginTop: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, 8px)',
          gridAutoRows: '8px',
          gridGap: 1,
        }}
      >
        {info.blocks.map((block, index) => (
          <div
            key={String(index)}
            title={`Block ${index}`}
            style={{
              backgroundColor: block ? 'green' : 'red',
            }}
          />
        ))}
      </div>
    </div>
  )
}

declare module 'hypermerge/dist/hypercore' {
  // The hypermerge Feed type is not quite correct:
  interface Feed<T> {
    on(event: 'append', cb: () => void): this
    off(event: string, cb: Function): this
  }
}

interface FeedInfo {
  writable: boolean
  downloaded: number
  total: number
  blocks: boolean[]
}

function useFeedInfo(feedId: FeedId): FeedInfo {
  const feed = useFeed(feedId)
  const [info, update] = useImmer<FeedInfo>({
    writable: false,
    downloaded: 0,
    total: 0,
    blocks: [],
  })

  useEffect(() => {
    if (!feed) return () => {}

    function setTotals(info: FeedInfo) {
      if (!feed) return
      info.total = feed.length
      info.downloaded = feed.downloaded()
    }

    function onReady() {
      update((info) => {
        if (!feed) return
        info.writable = feed.writable
        info.blocks = Array(feed.length).fill(false)
        setTotals(info)

        for (let i = 0; i < feed.length; i += 1) {
          info.blocks[i] = feed.has(i)
        }
      })
    }

    function onDownload(index: number) {
      update((info) => {
        info.blocks[index] = true
        setTotals(info)
      })
    }

    function onAppend() {
      update((info) => {
        info.blocks.push(true)
        setTotals(info)
      })
    }

    feed
      .on('download', onDownload)
      .on('append', onAppend)
      .ready(onReady)

    return () => {
      feed
        .off('ready', onReady)
        .off('append', onAppend)
        .off('download', onDownload)
    }
  }, [feed])

  return info
}

function useFeed(feedId: FeedId): Feed<Uint8Array> | null {
  const [feed, setFeed] = useState<Feed<Uint8Array> | null>(null)
  const repo = useRepo()

  useEffect(() => {
    repo.feeds.getFeed(feedId).then((fd) => {
      setFeed(fd)
    })
  }, [feedId])

  return feed
}
