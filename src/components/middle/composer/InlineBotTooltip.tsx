import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type {
  ApiBotInlineMediaResult, ApiBotInlineResult, ApiBotInlineSwitchPm, ApiBotInlineSwitchWebview,
} from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import setTooltipItemVisible from '../../../util/setTooltipItemVisible';
import buildClassName from '../../../util/buildClassName';
import { extractCurrentThemeParams } from '../../../util/themeStyle';
import { throttle } from '../../../util/schedulers';

import useShowTransition from '../../../hooks/useShowTransition';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import usePrevious from '../../../hooks/usePrevious';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import MediaResult from './inlineResults/MediaResult';
import ArticleResult from './inlineResults/ArticleResult';
import GifResult from './inlineResults/GifResult';
import StickerResult from './inlineResults/StickerResult';
import ListItem from '../../ui/ListItem';
import InfiniteScroll from '../../ui/InfiniteScroll';

import './InlineBotTooltip.scss';

const INTERSECTION_DEBOUNCE_MS = 200;
const runThrottled = throttle((cb) => cb(), 500, true);

export type OwnProps = {
  isOpen: boolean;
  botId?: string;
  isGallery?: boolean;
  inlineBotResults?: (ApiBotInlineResult | ApiBotInlineMediaResult)[];
  switchPm?: ApiBotInlineSwitchPm;
  switchWebview?: ApiBotInlineSwitchWebview;
  isSavedMessages?: boolean;
  canSendGifs?: boolean;
  onSelectResult: (
    inlineResult: ApiBotInlineMediaResult | ApiBotInlineResult, isSilent?: boolean, shouldSchedule?: boolean
  ) => void;
  loadMore: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
  isCurrentUserPremium?: boolean;
};

const InlineBotTooltip: FC<OwnProps> = ({
  isOpen,
  botId,
  isGallery,
  inlineBotResults,
  switchPm,
  switchWebview,
  isSavedMessages,
  canSendGifs,
  loadMore,
  onClose,
  onSelectResult,
  isCurrentUserPremium,
}) => {
  const {
    openChat,
    startBot,
    requestSimpleWebView,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);
  const renderedIsGallery = useCurrentOrPrev(isGallery, shouldRender);
  const {
    observe: observeIntersection,
  } = useIntersectionObserver({
    rootRef: containerRef,
    debounceMs: INTERSECTION_DEBOUNCE_MS,
    isDisabled: !isOpen,
  });

  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (direction === LoadMoreDirection.Backwards) {
      runThrottled(loadMore);
    }
  }, [loadMore]);

  const selectedIndex = useKeyboardNavigation({
    isActive: isOpen,
    shouldRemoveSelectionOnReset: renderedIsGallery,
    noArrowNavigation: renderedIsGallery,
    items: inlineBotResults,
    onSelect: onSelectResult,
    onClose,
  });

  useEffect(() => {
    setTooltipItemVisible('.chat-item-clickable', selectedIndex, containerRef);
  }, [selectedIndex]);

  const handleSendPm = useCallback(() => {
    openChat({ id: botId });
    startBot({ botId: botId!, param: switchPm!.startParam });
  }, [botId, openChat, startBot, switchPm]);

  const handleOpenWebview = useCallback(() => {
    const theme = extractCurrentThemeParams();

    requestSimpleWebView({
      botId: botId!,
      url: switchWebview!.url,
      buttonText: switchWebview!.text,
      theme,
    });
  }, [botId, switchWebview]);

  const prevInlineBotResults = usePrevious(
    inlineBotResults?.length
      ? inlineBotResults
      : undefined,
    shouldRender,
  );
  const renderedInlineBotResults = inlineBotResults?.length ? inlineBotResults : prevInlineBotResults;

  if (!shouldRender || !(renderedInlineBotResults?.length || switchPm)) {
    return undefined;
  }

  const className = buildClassName(
    'InlineBotTooltip composer-tooltip',
    IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
    renderedIsGallery && 'gallery',
    transitionClassNames,
  );

  function renderSwitchPm() {
    return (
      <ListItem ripple className="switch-pm scroll-item" onClick={handleSendPm}>
        <span className="title">{switchPm!.text}</span>
      </ListItem>
    );
  }

  function renderSwitchWebview() {
    return (
      <ListItem ripple className="switch-pm scroll-item" onClick={handleOpenWebview}>
        <span className="title">{switchWebview!.text}</span>
      </ListItem>
    );
  }

  function renderContent() {
    return renderedInlineBotResults!.map((inlineBotResult, index) => {
      switch (inlineBotResult.type) {
        case 'gif':
          return (
            <GifResult
              key={inlineBotResult.id}
              inlineResult={inlineBotResult}
              observeIntersection={observeIntersection}
              onClick={onSelectResult}
              isSavedMessages={isSavedMessages}
              canSendGifs={canSendGifs}
            />
          );

        case 'photo':
          return (
            <MediaResult
              key={inlineBotResult.id}
              isForGallery={renderedIsGallery}
              inlineResult={inlineBotResult}
              onClick={onSelectResult}
            />
          );

        case 'sticker':
          return (
            <StickerResult
              key={inlineBotResult.id}
              inlineResult={inlineBotResult}
              observeIntersection={observeIntersection}
              onClick={onSelectResult}
              isSavedMessages={isSavedMessages}
              isCurrentUserPremium={isCurrentUserPremium}
            />
          );

        case 'video':
        case 'file':
        case 'game':
          return (
            <MediaResult
              key={inlineBotResult.id}
              focus={selectedIndex === index}
              inlineResult={inlineBotResult}
              onClick={onSelectResult}
            />
          );
        case 'article':
        case 'audio':
        case 'voice':
          return (
            <ArticleResult
              key={inlineBotResult.id}
              focus={selectedIndex === index}
              inlineResult={inlineBotResult}
              onClick={onSelectResult}
            />
          );

        default:
          return undefined;
      }
    });
  }

  return (
    <InfiniteScroll
      ref={containerRef}
      className={className}
      items={renderedInlineBotResults}
      itemSelector=".chat-item-clickable"
      noFastList
      onLoadMore={handleLoadMore}
      sensitiveArea={160}
    >
      {switchPm && renderSwitchPm()}
      {switchWebview && renderSwitchWebview()}
      {Boolean(renderedInlineBotResults?.length) && renderContent()}
    </InfiniteScroll>
  );
};

export default memo(InlineBotTooltip);
