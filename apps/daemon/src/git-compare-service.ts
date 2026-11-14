import {HttpError} from './app.ts';
import type {App} from './app.ts';
import type {GitReview} from './git-review.ts';
import type {GithubLinks} from './github-links.ts';
import {sessionLinks} from './git-session-links.ts';
import {gitCompare,gitCompareFile,gitCompareRefs,githubCompareResult,githubRepo,resolvePulls} from './git-compare.ts';
import type {CompareEvidence,ComparePulls,CompareSide,GitCompareResult} from './git-compare-types.ts';

/** GIT-8 Compare, behind the Git consent (GIT-7). Reads only; the one network path is the person's own `gh`, opted in under Settings. */
export class GitCompareService {
  private app:App;private review:GitReview;private github:GithubLinks;
  constructor(app:App,review:GitReview,github:GithubLinks){this.app=app;this.review=review;this.github=github;}
  refs(id:string){return this.review.inspect(id,gitCompareRefs);}
  compare(id:string,query:{base:string;head:string}):Promise<GitCompareResult> {
    return this.review.inspect(id,async git=>{
      const result=await gitCompare(git,query);
      // The same hash-in-captured-output rule the Git graph uses; a link says the session printed this commit, not that it wrote it.
      const links=sessionLinks(this.app.store,this.app.checkoutOwner(id),result.commits.map(commit=>commit.hash));
      return {...result,commits:result.commits.map(commit=>links[commit.hash]?{...commit,session:links[commit.hash]}:commit)};
    });
  }
  file(id:string,query:{base:string;head:string;path:string;side:'head'|'base'}){return this.review.inspect(id,git=>gitCompareFile(git,query));}
  pulls(id:string):Promise<ComparePulls> {
    return this.review.inspect(id,async git=>{
      const repo=await githubRepo(git);
      if(!repo)return {status:'no-remote',pulls:[]};
      const reply=await this.github.pulls(repo);
      return {status:reply.status,repo,pulls:reply.status==='ready'?await resolvePulls(git,reply.pulls):[]};
    });
  }
  /** A pull request whose head commit is not here: GitHub's compare, for the compare side's changes only. */
  remote(id:string,number:number):Promise<GitCompareResult> {
    return this.review.inspect(id,async git=>{
      const repo=await githubRepo(git);
      if(!repo)throw new HttpError(404,'This repository has no GitHub remote, so a pull request cannot be read.');
      const listed=await this.github.pulls(repo);
      if(listed.status!=='ready')throw new HttpError(409,listed.status==='disabled'?'GitHub lookups are off. Turn them on in Settings to read pull requests.':listed.status==='gh-missing'?'The GitHub CLI (gh) is not installed.':listed.status==='gh-unauthenticated'?'Sign in with the GitHub CLI (gh auth login) to read this pull request. The branch is not on this machine.':'GitHub could not be reached.');
      const [pull]=await resolvePulls(git,listed.pulls.filter(item=>item.number===number));
      if(!pull)throw new HttpError(404,'This pull request is no longer open.');
      const reply=await this.github.compare(repo,pull.baseName,pull.headOid);
      if(reply.status!=='ready')throw new HttpError(409,reply.status==='gh-unauthenticated'?'Sign in with the GitHub CLI (gh auth login) to read this pull request. The branch is not on this machine.':'GitHub could not compare this pull request.');
      const base:CompareSide={ref:pull.baseRef?.ref??`refs/heads/${pull.baseName}`,name:pull.baseName,tip:pull.baseRef?.tip??''};
      return githubCompareResult(reply.value,base,{ref:pull.headOid,name:pull.headName,tip:pull.headOid});
    });
  }
  async evidence(id:string,paths:string[]):Promise<CompareEvidence>{
    const prefix=this.app.checkoutPrefix(id);
    const evidence=await this.app.history.compareEvidence(this.app.readingId(id),prefix?paths.map(path=>`${prefix}/${path}`):paths);
    return prefix?Object.fromEntries(paths.flatMap(path=>evidence[`${prefix}/${path}`]?[[path,evidence[`${prefix}/${path}`]!]]:[])):evidence;
  }
}
