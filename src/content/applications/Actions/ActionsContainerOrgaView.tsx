import PageHeader from './PageHeader';
import PageTitleWrapper from 'src/components/PageTitleWrapper';
import { Grid, Container, LinearProgress } from '@mui/material';
import Footer from 'src/components/Footer';
import React, { useContext, useEffect, useState } from 'react';

import Actions from './Actions';
import AddActionModal from './AddActionModal';
import { AppContext } from 'src/contexts/AppContext';
import { useWeb3ExecuteFunction, useMoralis, useMoralisQuery } from 'react-moralis';
import { getEligibleFormattedContests } from 'src/helpers/utils';
import { useSnackbar } from 'notistack';

function ActionsContainerOrgaView() {
	const { enqueueSnackbar } = useSnackbar();
	const { Moralis, account } = useMoralis();
	const { abi, contractAddress, currentUser } = useContext(AppContext);
	const { data, isLoading, isFetching, fetch, error } = useWeb3ExecuteFunction();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [newAction, setNewAction] = useState<any>(null);
	const [eligibleContests, setEligibleContests] = useState<any[]>([]);
	const [organization, setOrganization] = useState<any>(null);
	const [actions, setActions] = useState<Array<any>>([]);

	const {
		data: contestData,
		error: contestError,
		isLoading: isLoadingContest,
	} = useMoralisQuery('Contests', (query) => query.includeAll(), [], {
		live: true,
	});

	const {
		data: actionsData,
		error: actionError,
		isLoading: isLoadingAction,
	} = useMoralisQuery('Actions', (query) => query.includeAll(), [], {
		live: true,
	});

	useEffect(() => {
		getOrganization();
		queryActions();
	}, []);

	useEffect(() => {
		if (contestData && organization) {
			const eligibleContest = getEligibleFormattedContests(contestData, organization, account);
			setEligibleContests(eligibleContest);
		}
	}, [contestData, organization]);

	useEffect(() => {
		queryActions();
	}, [actionsData, eligibleContests]);

	useEffect(() => {
		if (!isLoadingAction && !isLoadingContest) {
			const err = actionError || contestError;
			if (err) {
				enqueueSnackbar(err[0] ?? JSON.stringify(err), { variant: 'error' });
			}
		}
	}, [actionError, contestError, isLoadingContest, isLoadingAction]);

	useEffect(() => {
		const addrGrantOrga = (
			data as any
		)?.events?.ActionCreated?.returnValues?.addressContestCreator?.toLowerCase();
		if (!(isLoading && isFetching && error) && newAction?.name && addrGrantOrga) {
			const queryFunc = async () => {
				const contestId = eligibleContests.find(
					(c) => c.addrGrantOrga?.toLowerCase() === addrGrantOrga
				)?.id;

				const Actions = Moralis.Object.extend('Actions');
				const actionInstance = new Actions();

				actionInstance?.save({ ...newAction, contestId, nbOfVotes: 0, addrOrgaCreator: account });
				const queryContest = new Moralis.Query('Contests');
				const query = await queryContest.equalTo('objectId', contestId);
				const queryResult = await query.first();
				queryResult?.addUnique('addrActionCreators', account);
				queryResult?.save();
			};
			queryFunc();
			setNewAction(null);
		}
	}, [data, newAction]);

	const queryActions = async () => {
		if (actionsData && eligibleContests?.length > 0) {
			const actionCreatorAddrs = eligibleContests?.map((c) => c?.addrActionCreators)?.flat();
			const setAddr = new Set(actionCreatorAddrs);
			const arrayAddr = Array.from(setAddr);
			const queryActions = new Moralis.Query('Actions');
			const query = await queryActions.containedIn('addrOrgaCreator', arrayAddr);
			const filteredActions = await query.find();
			setActions(filteredActions);
		}
	};

	const getOrganization = async () => {
		const query = new Moralis.Query('Organisations');
		const orga = await query.equalTo('ethAddress', account).first();
		setOrganization(orga);
	};

	const toggleModalState = () => setIsModalOpen(!isModalOpen);

	const handleSubmit = (action: any) => {
		const contractData: any = {
			abi,
			contractAddress,
			functionName: 'createAction',
			params: {
				_name: action.name,
				_creatorOfContest: action.addrGrantOrga,
				_requiredFunds: Moralis.Units.ETH(action.requiredFunds),
			},
		};
		fetch({ params: contractData });
		setNewAction(action);
	};

	return (
		<>
			<PageTitleWrapper>
				<PageHeader onAddNewAction={toggleModalState} isActionDisabled={false} />
			</PageTitleWrapper>
			<Container maxWidth="lg">
				<Grid container direction="row" justifyContent="center" alignItems="stretch" spacing={3}>
					<Grid item xs={12}>
						{(isLoading || isFetching || isLoadingContest) && <LinearProgress color="primary" />}
						<Actions currentUser={currentUser} actions={actions} />
					</Grid>
				</Grid>
			</Container>
			<Footer />
			{isModalOpen && (
				<AddActionModal
					isOpen={isModalOpen}
					onClose={toggleModalState}
					onSubmit={handleSubmit}
					eligibleContests={eligibleContests}
				/>
			)}
		</>
	);
}

export default ActionsContainerOrgaView;
