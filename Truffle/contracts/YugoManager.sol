// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IYugo.sol";
import "./interfaces/IYugoDao.sol";

contract YugoManager is Ownable {

    IYugo private yugo;
    IYugoDao private yugoDao;

    uint yugoTokenCost = 100000000000000000; //0.1 ETH
    mapping (address => uint) EthLedger;
    mapping (address => bool) EligibleToClaimYugo;
    bool internal locked;

    modifier noReentrant() {
        require(!locked, "No re-entrancy");
        locked = true;
        _;
        locked = false;
    }

    // event AddressSet (address addrSetTo, address setter);
    event YugoTransfer (address recipient, uint256 amount);
    event Received(address organisation, uint value);
    event TokenPurchasedBy(address organisation);
    event FundsTransferedToWinner(address organisation);
    event ContractsAddrSet(address yugo, address yugodao);

    /**
    * @notice receives ETH
    * @dev verifies that the organisation is registered
    * @dev verifies that the caller did not purchase a token before
    * @dev verifies that the ETH sent equals the token price
    */
    receive() external payable {
        purchaseYugo();
    }
        
    function purchaseYugo() public payable {
        require(yugoDao.organisationRegistrationStatus(msg.sender) == true, 'you need to be registered to purchase the token');
        require(EthLedger[msg.sender] == 0, 'you have made a deposit');
        require(yugo.balanceOf(msg.sender) == 0, "you already purchased a token");
        require(msg.value == yugoTokenCost, "you do not have enough ETH");
        address sender = msg.sender;
        uint deposited = msg.value;
        EthLedger[sender] = deposited; // specifies that ETH was deposited
        EligibleToClaimYugo[msg.sender] = true; //specifies that Yugo can now be claimed by the caller
        emit Received(msg.sender, msg.value);
    }

    /**
    * @notice sends ETH to pay the platform staff, only the admin can call it
    * @param _to - the address of a staff member
    * @dev requires success
    */
    function sendEth(address payable _to) public payable onlyOwner {
        bool sent = _to.send(msg.value);
        require(sent, "Failed to send Ether");
    }

    /**
    * @notice checks the Yugo balance of an account
    * @return a balance type uint256
    */
    function yugoBalanceOf(address account) public view returns (uint256) {
        return yugo.balanceOf(account);
    }

    function setContractsAddresses(address _yugo, address _dao) external onlyOwner {
        yugo = IYugo(_yugo);
        yugoDao = IYugoDao(_dao);
        emit ContractsAddrSet(_yugo, _dao);
    }

    /**
    * @notice Returns deposit state of organization
    * @return _ledgerState boolean true if organisation has deposit for yugo token
    */
    function hasEthDeposit() external view returns(bool _ledgerState) {        
        _ledgerState = EthLedger[msg.sender] == yugoTokenCost;
        return _ledgerState;
    }

    /**
    * @notice claim Yugo token 
    * @dev the ETH ledger of the caller must show that the token was purchased
    * @dev The Yugo Ledger of the caller must be at 0. Either because it is a 
    * first time purchase or because the period of validity of the token has passed
    * and must renewed
    * @dev Re-entrancy - the noReentrant modifier ensures that the function can not
    * be run multiple times in parallel. The function is locked until it finishes.  
    * @dev Pull-Over-Push - the token was not sent after purchase but the buyer was marked as 
    * eligible to claim the token. Afterwards, the condition of eligibility is updated before 
    * the transfer. 
    */
    function transferYugo() external noReentrant {
        require(EthLedger[msg.sender] == yugoTokenCost, "no ETH was received");
        require(EligibleToClaimYugo[msg.sender] == true, "You already received your Yugo");
        EligibleToClaimYugo[msg.sender] = false;
        uint256 amount = 1*10**yugo.decimals();
        yugo.transfer(msg.sender, amount);
        emit YugoTransfer(msg.sender, amount);
    }


    // TODO:function verifyByOracle orga

}