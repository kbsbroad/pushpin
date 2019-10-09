import React, { useEffect } from 'react'
import Unfluff from 'unfluff'
import Debug from 'debug'

import { Handle, HyperfileUrl } from 'hypermerge'
import * as Hyperfile from '../../hyperfile'
import ContentTypes from '../../ContentTypes'
import { ContentProps } from '../Content'
import { ChangeFn, useDocument } from '../../Hooks'
import { HypermergeUrl } from '../../ShareLink'
import Text from '../Text'
import './UrlContent.css'
import SecondaryText from '../SecondaryText'
import Badge from '../Badge'
import Heading from '../Heading'

const log = Debug('pushpin:url')

interface UrlData {
  title?: string
  image?: string
  description?: string
  canonicalLink?: string
}

interface UrlDoc {
  url: string
  data?: UrlData | { error: string } // TODO: move error to top-level
  html?: string // not yet implemented, see clipper branch
  imageHyperfileUrl?: string
}

UrlContent.minWidth = 9
UrlContent.minHeight = 9
UrlContent.defaultWidth = 12
// UrlContent.defaultHeight = 18
UrlContent.maxWidth = 24
UrlContent.maxHeight = 32

export default function UrlContent(props: ContentProps) {
  const [doc] = useRefreshedDocument(props.hypermergeUrl)

  if (!doc) {
    return null
  }
  const { data, url, html } = doc

  if (!data) {
    return (
      <div className="urlCard">
        <p className="urlCard-title">Fetching...</p>
        <p className="urlCard-link">
          <a className="urlCard-titleAnchor" href={url}>
            {url}
          </a>
        </p>
      </div>
    )
  }

  if ('error' in data) {
    return (
      <div className="urlCard">
        <p className="urlCard-error">(URL did not load.)</p>
        <p className="urlCard-link">
          <a className="urlCard-titleAnchor" href={url}>
            {url}
          </a>
        </p>
      </div>
    )
  }
  if (props.context === 'workspace') {
    return (
      <div className="urlCard urlCard--workspace">
        <div className="urlCard-banner">
          {doc.imageHyperfileUrl ? (
            <img className="urlCard-img" src={doc.imageHyperfileUrl} alt={data.description} />
          ) : null}

          <div className="urlCard-banner-title">
            {data.title ? (
              <>
                <Heading>{data.title}</Heading>
                <SecondaryText>
                  <a href={data.canonicalLink || url}>{data.canonicalLink || url}</a>
                </SecondaryText>
              </>
            ) : (
              <Heading>{url}</Heading>
            )}
          </div>
        </div>
        {html ? (
          <iframe frameBorder="0" title={data.title} srcDoc={html} />
        ) : (
          <iframe
            className="urlCard-iframe"
            frameBorder="0"
            title={data.title}
            src={data.canonicalLink || url}
          />
        )}
      </div>
    )
  }

  return (
    <div className="urlCard">
      {doc.imageHyperfileUrl ? (
        <img className="urlCard-img" src={doc.imageHyperfileUrl} alt={data.description} />
      ) : null}

      <p className="urlCard-title">
        <span className="titleAnchor">{data.title}</span>
      </p>

      <p className="urlCard-text">{data.description}</p>
      <p className="urlCard-link">
        <span className="urlCard-titleAnchor">
          <a href={data.canonicalLink || url}>{data.canonicalLink || url}</a>
        </span>
      </p>
    </div>
  )
}

function useRefreshedDocument(url: HypermergeUrl): [null | UrlDoc, ChangeFn<UrlDoc>] {
  const [doc, change] = useDocument<UrlDoc>(url)

  useEffect(() => {
    if (doc) {
      refreshContent(doc, change)
    }
  }, [doc && doc.url])

  useEffect(() => {
    if (doc) {
      refreshImageContent(doc, change)
    }
  }, [doc && doc.data])

  return [doc, change]
}

function refreshContent(doc: UrlDoc, change: ChangeFn<UrlDoc>) {
  if (!doc.url || doc.data) {
    return
  }

  unfluffUrl(doc.url)
    .then((data) => {
      change((doc: UrlDoc) => {
        removeEmpty(data)
        doc.data = data
      })
    })
    .catch((reason) => {
      log('refreshContent.caught', reason)
      change((doc: UrlDoc) => {
        doc.data = { error: reason }
      })
    })
}

function refreshImageContent(doc: UrlDoc, change: ChangeFn<UrlDoc>) {
  if (doc.imageHyperfileUrl) {
    return
  }

  if (!doc.data || !('image' in doc.data)) {
    return
  }

  const { image } = doc.data

  if (!image) {
    return
  }

  uploadImageUrl(image).then((hyperfileUrl) => {
    change((doc: UrlDoc) => {
      doc.imageHyperfileUrl = hyperfileUrl
    })
  })
}

function unfluffUrl(url: string): Promise<UrlData> {
  return fetch(url)
    .then((response) => response.text())
    .then<UrlData>(Unfluff)
    .then((data) => {
      removeEmpty(data)

      if (data.image) {
        data.image = new URL(data.image, url).toString()
      }

      return data
    })
}

function uploadImageUrl(url: string): Promise<HyperfileUrl> {
  return fetch(url)
    .then((response) => response.arrayBuffer())
    .then((buffer) => Hyperfile.writeBuffer(new Uint8Array(buffer)))
}

function removeEmpty(obj: object) {
  Object.entries(obj).forEach(([key, val]) => {
    if (val && typeof val === 'object') {
      removeEmpty(val)
    } else if (val == null) {
      delete obj[key]
    }
  })
}

function create({ url }, handle: Handle<UrlDoc>, callback) {
  handle.change((doc) => {
    doc.url = url
  })
  callback()
}

function UrlContentInList(props: ContentProps) {
  const [doc] = useDocument<UrlDoc>(props.hypermergeUrl)
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('application/pushpin-url', props.url)
  }

  if (!doc) return null

  const title = doc.data && !('error' in doc.data) ? doc.data.title : doc.url

  return (
    <div className="DocLink">
      <span draggable onDragStart={onDragStart}>
        <Badge icon="chain" />
      </span>
      <div className="DocLink__title">{title}</div>
    </div>
  )
}
ContentTypes.register({
  type: 'url',
  name: 'URL',
  icon: 'chain',
  contexts: {
    workspace: UrlContent,
    board: UrlContent,
    list: UrlContentInList,
  },
  create,
  unlisted: true,
})
