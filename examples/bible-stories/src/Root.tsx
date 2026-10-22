import { CalculateMetadataFunction, Composition } from 'remotion';
import { WhoStopped, WhoStoppedProps, defaultWhoStoppedProps } from './WhoStopped';
import { AsHeDidBefore, AsHeDidBeforeProps, defaultAsHeDidBeforeProps } from './AsHeDidBefore';
import { WhoStoppedShorts, WhoStoppedShortsProps, defaultWhoStoppedShortsProps } from './WhoStoppedShorts';

const FPS = 30;

const durationFromProps = <Props extends { durationSeconds: number }>(): CalculateMetadataFunction<Props> => {
  return async ({ props }) => ({
    durationInFrames: Math.max(FPS, Math.ceil(props.durationSeconds * FPS)),
  });
};

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="WhoStopped"
        component={WhoStopped}
        durationInFrames={Math.round(defaultWhoStoppedProps.durationSeconds * FPS)}
        calculateMetadata={durationFromProps<WhoStoppedProps>()}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={defaultWhoStoppedProps}
      />
      <Composition
        id="AsHeDidBefore"
        component={AsHeDidBefore}
        durationInFrames={Math.round(defaultAsHeDidBeforeProps.durationSeconds * FPS)}
        calculateMetadata={durationFromProps<AsHeDidBeforeProps>()}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={defaultAsHeDidBeforeProps}
      />
      <Composition
        id="WhoStoppedShorts"
        component={WhoStoppedShorts}
        durationInFrames={Math.round(defaultWhoStoppedShortsProps.durationSeconds * FPS)}
        calculateMetadata={durationFromProps<WhoStoppedShortsProps>()}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={defaultWhoStoppedShortsProps}
      />
    </>
  );
};
